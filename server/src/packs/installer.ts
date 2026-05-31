/**
 * server/src/packs/installer.ts
 *
 * Pack installation — M12.
 *
 * 7-step atomic installation:
 *   Steps 1–5  run inside a DB transaction (rollback on any failure).
 *   Steps 6–7  run after transaction commits (BullMQ — idempotent).
 *
 *   1. Validate pack manifest                   (pure, no DB)
 *   2. Install agents                           (insert agents rows)
 *   3. Install skills                           (insert company_skills rows)
 *   4. Install quality gates                    (insert qualityGates rows)
 *   5. Upsert company DNA                       (upsert companyDna row)
 *   6. Schedule seed tasks via BullMQ           (delay ≤ 10 min — RULE: fires < 10min)
 *   7. Register activation triggers in BullMQ   (scheduled moments)
 *
 * If step 4 (or any earlier step) throws, the transaction rolls back steps 2–3
 * automatically. Steps 6–7 are never reached.
 *
 * RULE 6: BullMQ jobs are idempotent (jobId deduplication).
 * RULE 10: Seed tasks must be indistinguishable from real work.
 */

import { agents, companySkills, qualityGates, companyDna, AGENT_COLOURS } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { interpolateTemplate } from "./template.js";
import { parseSkill } from "../skills/parser.js";
import { BASE_CONSTITUTION } from "../safety/constitution.js";
import { bootstrapAgentTrust } from "../trust/bootstrap.js";
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
  slug:        z.string().regex(/^[a-z0-9-]+$/),
  name:        z.string().min(3).max(100),
  version:     z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500).optional(),
  agents:      z.array(AgentManifestSchema).min(1).max(10),
  skills:      z.array(z.unknown()).min(1),
  qualityGates: z.array(z.unknown()),
  seedTasks:   z.array(z.unknown()).min(1),
  activationSequence: z.array(z.unknown()).length(5),
});

export function validatePackManifest(pack: unknown): void {
  const result = PackManifestSchema.safeParse(pack);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue?.path.join(".") ?? "unknown";
    const msg   = firstIssue?.message ?? "Invalid manifest";
    throw new PackValidationError(`Pack manifest invalid — ${field}: ${msg}`);
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
        metadata: agentMeta,
      })
      .onConflictDoUpdate({
        target: [agents.companyId, agents.slug],
        set: {
          displayName: def.displayName ?? def.name,
          soulMd,
          metadata:    agentMeta,
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

    await (tx as any)
      .insert(companySkills)
      .values({
        companyId,
        key:          def.slug,
        slug:         def.slug,
        name:         def.name,
        markdown,
        sourceType:   "pack",
        gdprRequired,
        tier,
        aiActRisk:    safeRisk,
        metadata:     capabilityMetadata,
      })
      .onConflictDoUpdate({
        target: [companySkills.companyId, companySkills.key],
        set: {
          markdown,
          name:         def.name,
          sourceType:   "pack",
          gdprRequired,
          tier,
          aiActRisk:    safeRisk,
          metadata:     capabilityMetadata,
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
  const desc       = interpolateTemplate(dna.description       ?? "", variables);
  const profile    = interpolateTemplate(dna.customerProfile   ?? "", variables);
  const tone       = interpolateTemplate(dna.tone              ?? "", variables);
  const regulatory = interpolateTemplate(dna.regulatoryContext ?? "", variables);

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

// ── Step 6: Seed tasks ────────────────────────────────────────────────────────

async function scheduleSeedTasks(
  agentQueue: InstallPackParams["agentQueue"],
  params: {
    companyId: string;
    seedTasks: PackManifest["seedTasks"];
    agentIds:  string[];
    variables: Record<string, string>;
  },
): Promise<void> {
  for (let i = 0; i < params.seedTasks.length; i++) {
    const task = params.seedTasks[i];

    const title = interpolateTemplate(task.title, params.variables);
    const body  = interpolateTemplate(task.body,  params.variables);

    // Cap delay at SEED_TASK_MAX_DELAY_MS — spec requires firing within 10 min
    const delay = Math.min(task.delayMs ?? 0, SEED_TASK_MAX_DELAY_MS);

    await agentQueue.add(
      "seed.task",
      {
        companyId:  params.companyId,
        agentSlug:  task.agentSlug,
        title,
        body,
      },
      {
        delay,
        // Idempotency: same seed task won't be double-scheduled (RULE 6)
        jobId: `seed-${params.companyId}-${task.agentSlug}-${i}`,
      },
    );
  }
}

// ── Step 7: Activation triggers ───────────────────────────────────────────────

async function registerActivationTriggers(
  systemQueue: InstallPackParams["systemQueue"],
  params: {
    companyId:  string;
    packSlug:   string;
    triggers:   PackManifest["activationSequence"];
  },
): Promise<void> {
  for (const trigger of params.triggers) {
    const delayMs = trigger.dayThreshold * 24 * 60 * 60 * 1000;

    await systemQueue.add(
      "activation.check",
      {
        companyId:  params.companyId,
        packSlug:   params.packSlug,
        triggerKey: trigger.key,
      },
      {
        delay: delayMs,
        // Idempotent per company + trigger key (RULE 6)
        jobId: `activation-${params.companyId}-${params.packSlug}-${trigger.key}`,
      },
    );
  }
}

// ── Main installer ────────────────────────────────────────────────────────────

/**
 * Install a pack into a company account.
 *
 * Steps 1–5 run in a single DB transaction; any failure rolls back all DB writes.
 * Steps 6–7 are BullMQ scheduling and run post-commit; they are idempotent.
 */
export async function installPack(
  db: Db,
  params: InstallPackParams,
): Promise<InstallPackResult> {
  const { companyId, pack, variables, agentQueue, systemQueue } = params;

  logger.info({ companyId, packSlug: pack.slug }, "pack-installer: starting");

  let agentIds: string[] = [];

  // Steps 1–5: atomic DB transaction
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
    });
  } catch (err) {
    const step = err instanceof PackValidationError ? 1 : 4;
    throw new PackInstallError(
      `Pack installation failed: ${(err as Error).message}`,
      step,
      err,
    );
  }

  // Gap C: Bootstrap trust scores for all installed agents
  await bootstrapAgentTrust(db, companyId, agentIds, {
    skillType:     pack.skills[0]?.slug,
    industrySlug:  variables.industry ?? undefined,
  }).catch((err) => logger.warn({ err }, "trust-bootstrap: non-fatal failure"));

  // Step 6: Schedule seed tasks (within 10 min)
  await scheduleSeedTasks(agentQueue, { companyId, seedTasks: pack.seedTasks, agentIds, variables });

  // Step 7: Register activation triggers
  await registerActivationTriggers(systemQueue, {
    companyId,
    packSlug: pack.slug,
    triggers: pack.activationSequence,
  });

  logger.info(
    { companyId, packSlug: pack.slug, agentIds },
    "pack-installer: complete",
  );

  return { success: true, agentIds, packSlug: pack.slug };
}
