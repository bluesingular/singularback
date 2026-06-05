/**
 * server/src/packs/installer.ts
 *
 * Pack installation — M12.
 *
 * 7-step atomic installation:
 *   All 7 steps run inside a single DB transaction (rollback on any failure).
 *
 *   1. Validate pack manifest                   (pure, no DB)
 *   2. Install agents                           (insert agents rows)
 *   3. Install skills                           (insert company_skills rows)
 *   4. Install quality gates                    (insert qualityGates rows)
 *   5. Upsert company DNA                       (upsert companyDna row)
 *   6. Queue seed tasks → pending_jobs outbox   (delay ≤ 10 min — RULE: fires < 10min)
 *   7. Queue activation triggers → pending_jobs outbox
 *
 * P5 — Transactional outbox: Steps 6–7 write to pending_jobs inside the
 * transaction. If anything rolls back, the job rows are rolled back too —
 * no orphaned BullMQ jobs. The outbox worker dispatches to BullMQ after commit.
 *
 * RULE 6: BullMQ jobs are idempotent (_jobId in payload → deduplication).
 * RULE 10: Seed tasks must be indistinguishable from real work.
 */

import { agents, companySkills, qualityGates, companyDna, pendingJobs, AGENT_COLOURS } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { interpolateTemplate } from "./template.js";
import { parseSkill } from "../skills/parser.js";
import { BASE_CONSTITUTION } from "../safety/constitution.js";
import { bootstrapAgentTrust } from "../trust/bootstrap.js";
import { sanitiseDNAValue } from "../safety/dna-sanitise.js";
import { copyMasterSkillToTenant } from "../services/company-skills.js";
import {
  PackValidationError,
  PackInstallError,
  type InstallPackParams,
  type InstallPackResult,
  type PackManifest,
} from "./types.js";
import pino from "pino";

const logger = pino({ name: "pack-installer" });

/** Max delay for seed tasks — 10 minutes. Tasks must fire within this window. */
export const SEED_TASK_MAX_DELAY_MS = 10 * 60 * 1000; // 600_000 ms

// ── Step 1: Validation ────────────────────────────────────────────────────────

// ── A1: Pack manifest Zod schema ─────────────────────────────────────────────

import { z } from "zod";

const AgentManifestSchema = z.object({
  slug:        z.string().regex(/^[a-z0-9-]+$/),
  name:        z.string().min(1).max(100),
  description: z.string().max(500),
  modelTier:   z.string(),
  skills:      z.array(z.string()),
  colour:      z.string().optional(),
  displayName: z.string().optional(),
  soulTemplate: z.string().optional(),
  constitutionExtension: z.string().optional(),
  handoffs:    z.array(z.unknown()).optional(),
});

const PackManifestSchema = z.object({
  slug:               z.string().regex(/^[a-z0-9-]+$/),
  name:               z.string().min(3).max(100),
  version:            z.string().regex(/^\d+\.\d+\.\d+$/),
  // A2: minPlatformVersion — pack declares minimum platform it requires
  minPlatformVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
  description:        z.string().max(500).optional(),
  agents:             z.array(AgentManifestSchema).min(1).max(10),
  skills:             z.array(z.unknown()).min(1),
  qualityGates:       z.array(z.unknown()),
  seedTasks:          z.array(z.unknown()).min(1),
  activationSequence: z.array(z.unknown()).length(5),
});

/** A2: semver comparison (no external dep — compare three numeric parts). */
function semverGte(a: string, b: string): boolean {
  const parse = (v: string) => v.split(".").map(Number) as [number, number, number];
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch >= bPatch;
}

export class PackIncompatibleError extends Error {
  constructor(slug: string, required: string, current: string) {
    super(`Pack "${slug}" requires platform v${required}, but running v${current}`);
    this.name = "PackIncompatibleError";
  }
}

export function validatePackManifest(pack: unknown): void {
  const result = PackManifestSchema.safeParse(pack);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue?.path.join(".") ?? "unknown";
    const msg   = firstIssue?.message ?? "Invalid manifest";
    throw new PackValidationError(`Pack manifest invalid — ${field}: ${msg}`);
  }

  // A2: platform version compatibility check
  const manifest = result.data;
  if (manifest.minPlatformVersion) {
    const platformVersion = process.env.PLATFORM_VERSION ?? "1.0.0";
    if (!semverGte(platformVersion, manifest.minPlatformVersion)) {
      throw new PackIncompatibleError(
        manifest.slug,
        manifest.minPlatformVersion,
        platformVersion,
      );
    }
  }
}

// ── WAR-2: soul.md generation ─────────────────────────────────────────────────

function buildSoulMd(def: PackManifest["agents"][number], variables: Record<string, string>): string {
  const template = def.soulTemplate ?? `# ${def.name}\n\nTu es ${def.name}, ${def.description}.`;
  const body = interpolateTemplate(template, variables);

  const extension = def.constitutionExtension
    ? `\n\n[[CONSTITUTION_EXTENSION]]\n${def.constitutionExtension}`
    : "";

  return `${body}\n\n${BASE_CONSTITUTION}${extension}`;
}

// ── WAR-5: team roster markdown ───────────────────────────────────────────────

function buildTeamRoster(
  companyName: string,
  agentDefs: PackManifest["agents"],
  agentIds: string[],
): string {
  const lines = [`# Votre équipe — ${companyName}`, ""];
  for (let i = 0; i < agentDefs.length; i++) {
    const def = agentDefs[i];
    lines.push(`## ${def.displayName ?? def.name} (actif)`);
    lines.push(`Rôle : ${def.description}`);
    lines.push(`Niveau de confiance : supervisé (2.5/5 sur 0 tâches)`);
    lines.push("");
  }
  return lines.join("\n");
}

// ── Steps 2–5: DB helpers ─────────────────────────────────────────────────────

async function installAgents(
  tx: Db,
  companyId: string,
  agentDefs: PackManifest["agents"],
  variables: Record<string, string> = {},
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < agentDefs.length; i++) {
    const def = agentDefs[i];
    // Assign colour sequentially from the approved palette if not declared
    const colour = def.colour && (AGENT_COLOURS as readonly string[]).includes(def.colour)
      ? def.colour
      : AGENT_COLOURS[i % AGENT_COLOURS.length];

    const agentMeta = {
      packDescription: def.description,
      skillsAssigned:  def.skills ?? [],
      handoffs:        def.handoffs ?? [],
    };
    // WAR-2: generate soul.md from template + base constitution
    const soulMd = buildSoulMd(def, variables);

    // Build heartbeat runtimeConfig from pack agent definition
    // heartbeat_frequency_ms from pack.json → intervalSec for heartbeatService
    const heartbeatIntervalMs = (def as any).heartbeat_frequency_ms ?? 14_400_000; // 4h default
    const runtimeConfig = {
      heartbeat: {
        enabled:           true,
        intervalSec:       Math.round(heartbeatIntervalMs / 1000),
        wakeOnDemand:      true,
        wakeOnAssignment:  true,
        maxConcurrentRuns: 3,
        cooldownSec:       10,
      },
    };

    const rows = await (tx as any)
      .insert(agents)
      .values({
        companyId,
        name:              def.name,
        slug:              def.slug,
        displayName:       def.displayName ?? def.name,
        colour,
        soulMd,
        teamRosterVisible: true,
        runtimeConfig,
        metadata: agentMeta,
      })
      .onConflictDoUpdate({
        target: [agents.companyId, agents.slug],
        set: {
          displayName:   def.displayName ?? def.name,
          soulMd,
          runtimeConfig,
          metadata:      agentMeta,
        },
      })
      .returning({ id: agents.id });
    ids.push(rows[0].id);
  }
  return ids;
}

async function installSkills(
  tx: Db,
  companyId: string,
  skillDefs: PackManifest["skills"],
  variables: Record<string, string>,
): Promise<void> {
  for (const def of skillDefs) {
    const markdown = interpolateTemplate(def.markdown, variables);

    // G2: parse capability declarations and store in metadata
    let capabilityMetadata: Record<string, unknown> = {};
    try {
      const parsed = parseSkill(markdown);
      capabilityMetadata = {
        tier:           parsed.tier,
        gdprRequired:   parsed.gdprRequired,
        webAccess:      parsed.webAccess,
        webScope:       parsed.webScope,
        autonomyTier:   parsed.autonomyTier,
        purpose:        parsed.purpose,
        dataCategories: parsed.dataCategories,
        inputs:         parsed.inputs,
        outputSchema:   parsed.outputSchema,
        aiAct:          parsed.aiAct,
        tools:          parsed.tools,
        configParams:   parsed.configParams,
      };
    } catch {
      // Non-fatal: skill installs even if parsing fails; metadata stays empty
    }

    const gdprRequired = Boolean(capabilityMetadata.gdprRequired ?? false);
    const tier         = Number(capabilityMetadata.tier ?? 1) as 0 | 1 | 2 | 3;
    const aiActRisk    = String((capabilityMetadata.aiAct as any)?.risk_level ?? "minimal");
    const safeRisk     = ["minimal","limited","high","unacceptable"].includes(aiActRisk)
      ? aiActRisk : "minimal";

    // §20 three-tier architecture: if the manifest declares sourceSkillId,
    // COPY from the master skill (Tier 1 → Tier 2) instead of inserting inline.
    // This is the canonical path once masters are seeded.
    const defAny = def as unknown as Record<string, unknown>;
    const sourceSkillId = defAny.sourceSkillId as string | undefined;

    if (sourceSkillId) {
      // Tier 1 → Tier 2 copy: tenant gets their own evolving copy
      await copyMasterSkillToTenant(tx, sourceSkillId, companyId);
      continue;
    }

    // Fallback: inline embed (used when manifest has no sourceSkillId)
    await (tx as any)
      .insert(companySkills)
      .values({
        companyId,
        key:           def.slug,
        slug:          def.slug,
        name:          def.name,
        markdown,
        sourceType:    "pack",
        gdprRequired,
        tier,
        aiActRisk:     safeRisk,
        metadata:      capabilityMetadata,
        sourceSkillId: null,
        masterVersion: null,
      })
      .onConflictDoUpdate({
        target: [companySkills.companyId, companySkills.key],
        set: {
          markdown,
          name:      def.name,
          sourceType: "pack",
          gdprRequired,
          tier,
          aiActRisk:  safeRisk,
          metadata:   capabilityMetadata,
        },
      });
  }
}

async function installQualityGates(
  tx: Db,
  companyId: string,
  gateDefs: PackManifest["qualityGates"],
): Promise<void> {
  for (const def of gateDefs) {
    await tx.insert(qualityGates).values({
      companyId,
      gateType: def.gateType,
      config:   def.config,
      enabled:  def.enabled,
    });
  }
}

async function installCompanyDna(
  tx: Db,
  companyId: string,
  dna: NonNullable<PackManifest["companyDna"]>,
  variables: Record<string, string> = {},
): Promise<void> {
  // C5 — sanitise all DNA values before interpolation to block prompt injection
  const desc       = sanitiseDNAValue(interpolateTemplate(dna.description       ?? "", variables), "description");
  const profile    = sanitiseDNAValue(interpolateTemplate(dna.customerProfile   ?? "", variables), "customerProfile");
  const tone       = sanitiseDNAValue(interpolateTemplate(dna.tone              ?? "", variables), "tone");
  const regulatory = sanitiseDNAValue(interpolateTemplate(dna.regulatoryContext ?? "", variables), "regulatoryContext");

  await (tx as any)
    .insert(companyDna)
    .values({
      companyId,
      description:       desc,
      customerProfile:   profile,
      tone:              tone,
      regulatoryContext: regulatory,
    })
    .onConflictDoUpdate({
      target: [companyDna.companyId],
      set: {
        description:       desc,
        customerProfile:   profile,
        tone:              tone,
        regulatoryContext: regulatory,
      },
    });
}

// ── Steps 6–7: Outbox writes (inside the DB transaction) ─────────────────────
//
// P5 — Transactional outbox pattern:
// Seed tasks and activation triggers are written to pending_jobs INSIDE the
// PostgreSQL transaction. If the transaction rolls back (e.g. quality gate
// install fails), these rows are never committed — jobs are never dispatched.
// The outbox worker polls pending_jobs every 5 s and enqueues to BullMQ.
// BullMQ jobId deduplication prevents double-dispatch on retries.

async function writeSeedTasksToOutbox(
  tx: Db,
  params: {
    companyId: string;
    seedTasks: PackManifest["seedTasks"];
    variables: Record<string, string>;
  },
): Promise<void> {
  for (let i = 0; i < params.seedTasks.length; i++) {
    const task = params.seedTasks[i];
    const title = interpolateTemplate(task.title, params.variables);
    const body  = interpolateTemplate(task.body,  params.variables);
    // Cap delay at SEED_TASK_MAX_DELAY_MS — spec requires firing within 10 min
    const delayMs = Math.min(task.delayMs ?? 0, SEED_TASK_MAX_DELAY_MS);

    await tx.insert(pendingJobs).values({
      queue: "install",
      payload: {
        jobName:   "seed.task",
        // _delayMs is extracted by the outbox worker and passed as BullMQ delay
        _delayMs:  delayMs,
        // _jobId is extracted by the outbox worker for BullMQ idempotency
        _jobId:    `seed-${params.companyId}-${task.agentSlug}-${i}`,
        companyId: params.companyId,
        agentSlug: task.agentSlug,
        title,
        body,
      } as any,
    });
  }
}

async function writeActivationTriggersToOutbox(
  tx: Db,
  params: {
    companyId: string;
    packSlug:  string;
    triggers:  PackManifest["activationSequence"];
  },
): Promise<void> {
  for (const trigger of params.triggers) {
    const delayMs = trigger.dayThreshold * 24 * 60 * 60 * 1000;

    await tx.insert(pendingJobs).values({
      queue: "system",
      payload: {
        jobName:    "activation.check",
        _delayMs:   delayMs,
        _jobId:     `activation-${params.companyId}-${params.packSlug}-${trigger.key}`,
        companyId:  params.companyId,
        packSlug:   params.packSlug,
        triggerKey: trigger.key,
      } as any,
    });
  }
}

// ── Main installer ────────────────────────────────────────────────────────────

/**
 * Install a pack into a company account.
 *
 * All 7 steps run in a single DB transaction.
 * Steps 6–7 write job rows to pending_jobs (P5 outbox pattern) — they are
 * dispatched to BullMQ by the outbox worker after the transaction commits.
 * If the transaction rolls back, the pending_jobs rows are rolled back too
 * and no jobs are dispatched. BullMQ jobId deduplication prevents double-
 * dispatch on outbox retries.
 */
export async function installPack(
  db: Db,
  params: InstallPackParams,
): Promise<InstallPackResult> {
  const { companyId, pack, variables } = params;

  logger.info({ companyId, packSlug: pack.slug }, "pack-installer: starting");

  let agentIds: string[] = [];

  // Steps 1–7: single atomic DB transaction
  try {
    await (db as any).transaction(async (tx: Db) => {
      // Step 1: Validate
      validatePackManifest(pack);

      // Step 2: Install agents
      agentIds = await installAgents(tx, companyId, pack.agents, variables);

      // Step 3: Install skills
      await installSkills(tx, companyId, pack.skills, variables);

      // Step 4: Install quality gates
      await installQualityGates(tx, companyId, pack.qualityGates);

      // Step 5: Upsert company DNA (template variables applied to each field)
      if (pack.companyDna) {
        await installCompanyDna(tx, companyId, pack.companyDna, variables);
      }

      // Step 6: Queue seed tasks via outbox (fires within 10 min after commit)
      await writeSeedTasksToOutbox(tx, { companyId, seedTasks: pack.seedTasks, variables });

      // Step 7: Queue activation triggers via outbox
      await writeActivationTriggersToOutbox(tx, {
        companyId,
        packSlug: pack.slug,
        triggers: pack.activationSequence,
      });
    });
  } catch (err) {
    const step = err instanceof PackValidationError ? 1 : 4;
    throw new PackInstallError(
      `Pack installation failed: ${(err as Error).message}`,
      step,
      err,
    );
  }

  // Gap C: Bootstrap trust scores for all installed agents (non-transactional, non-fatal)
  await bootstrapAgentTrust(db, companyId, agentIds, {
    skillType:     pack.skills[0]?.slug,
    industrySlug:  variables.industry ?? undefined,
  }).catch((err) => logger.warn({ err }, "trust-bootstrap: non-fatal failure"));

  logger.info(
    { companyId, packSlug: pack.slug, agentIds },
    "pack-installer: complete",
  );

  return { success: true, agentIds, packSlug: pack.slug };
}
