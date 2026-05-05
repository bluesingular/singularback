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
import { agents, companySkills, qualityGates, companyDna } from "@paperclipai/db";
import { interpolateTemplate } from "./template.js";
import { PackValidationError, PackInstallError, } from "./types.js";
import pino from "pino";
const logger = pino({ name: "pack-installer" });
/** Max delay for seed tasks — 10 minutes. Tasks must fire within this window. */
export const SEED_TASK_MAX_DELAY_MS = 10 * 60 * 1000; // 600_000 ms
// ── Step 1: Validation ────────────────────────────────────────────────────────
export function validatePackManifest(pack) {
    const required = [
        "slug", "name", "version", "agents", "skills", "qualityGates",
        "seedTasks", "activationSequence",
    ];
    for (const field of required) {
        if (pack[field] === undefined || pack[field] === null) {
            throw new PackValidationError(`Pack manifest missing required field: ${field}`);
        }
    }
    if (!Array.isArray(pack.agents) || pack.agents.length === 0) {
        throw new PackValidationError("Pack must define at least one agent");
    }
    if (!Array.isArray(pack.seedTasks) || pack.seedTasks.length === 0) {
        throw new PackValidationError("Pack must define at least one seed task");
    }
    if (!Array.isArray(pack.activationSequence) || pack.activationSequence.length !== 5) {
        throw new PackValidationError("Pack must define exactly 5 activation triggers");
    }
}
// ── Steps 2–5: DB helpers ─────────────────────────────────────────────────────
async function installAgents(tx, companyId, agentDefs) {
    const ids = [];
    for (const def of agentDefs) {
        // Use upsert to avoid duplicate agent errors
        const agentMeta = {
            packDescription: def.description,
            skillsAssigned: def.skills ?? [],
            handoffs: def.handoffs ?? [],
        };
        const rows = await tx
            .insert(agents)
            .values({
            companyId,
            name: def.name,
            metadata: agentMeta,
        })
            .onConflictDoUpdate({
            target: [agents.companyId, agents.name],
            set: {
                metadata: agentMeta,
            },
        })
            .returning({ id: agents.id });
        ids.push(rows[0].id);
    }
    return ids;
}
async function installSkills(tx, companyId, skillDefs, variables) {
    for (const def of skillDefs) {
        const markdown = interpolateTemplate(def.markdown, variables);
        await tx
            .insert(companySkills)
            .values({
            companyId,
            key: def.slug,
            slug: def.slug,
            name: def.name,
            markdown,
            sourceType: "pack",
        })
            .onConflictDoUpdate({
            target: [companySkills.companyId, companySkills.key],
            set: {
                markdown,
                name: def.name,
                sourceType: "pack",
            },
        });
    }
}
async function installQualityGates(tx, companyId, gateDefs) {
    for (const def of gateDefs) {
        await tx.insert(qualityGates).values({
            companyId,
            gateType: def.gateType,
            config: def.config,
            enabled: def.enabled,
        });
    }
}
async function installCompanyDna(tx, companyId, dna) {
    await tx
        .insert(companyDna)
        .values({
        companyId,
        description: dna.description ?? "",
        customerProfile: dna.customerProfile ?? "",
        tone: dna.tone ?? "",
        regulatoryContext: dna.regulatoryContext ?? "",
    })
        .onConflictDoUpdate({
        target: [companyDna.companyId],
        set: {
            description: dna.description ?? "",
            customerProfile: dna.customerProfile ?? "",
            tone: dna.tone ?? "",
            regulatoryContext: dna.regulatoryContext ?? "",
        },
    });
}
// ── Step 6: Seed tasks ────────────────────────────────────────────────────────
async function scheduleSeedTasks(agentQueue, params) {
    for (let i = 0; i < params.seedTasks.length; i++) {
        const task = params.seedTasks[i];
        const title = interpolateTemplate(task.title, params.variables);
        const body = interpolateTemplate(task.body, params.variables);
        // Cap delay at SEED_TASK_MAX_DELAY_MS — spec requires firing within 10 min
        const delay = Math.min(task.delayMs ?? 0, SEED_TASK_MAX_DELAY_MS);
        await agentQueue.add("seed.task", {
            companyId: params.companyId,
            agentSlug: task.agentSlug,
            title,
            body,
        }, {
            delay,
            // Idempotency: same seed task won't be double-scheduled (RULE 6)
            jobId: `seed-${params.companyId}-${task.agentSlug}-${i}`,
        });
    }
}
// ── Step 7: Activation triggers ───────────────────────────────────────────────
async function registerActivationTriggers(systemQueue, params) {
    for (const trigger of params.triggers) {
        const delayMs = trigger.dayThreshold * 24 * 60 * 60 * 1000;
        await systemQueue.add("activation.check", {
            companyId: params.companyId,
            packSlug: params.packSlug,
            triggerKey: trigger.key,
        }, {
            delay: delayMs,
            // Idempotent per company + trigger key (RULE 6)
            jobId: `activation-${params.companyId}-${params.packSlug}-${trigger.key}`,
        });
    }
}
// ── Main installer ────────────────────────────────────────────────────────────
/**
 * Install a pack into a company account.
 *
 * Steps 1–5 run in a single DB transaction; any failure rolls back all DB writes.
 * Steps 6–7 are BullMQ scheduling and run post-commit; they are idempotent.
 */
export async function installPack(db, params) {
    const { companyId, pack, variables, agentQueue, systemQueue } = params;
    logger.info({ companyId, packSlug: pack.slug }, "pack-installer: starting");
    let agentIds = [];
    // Steps 1–5: atomic DB transaction
    try {
        await db.transaction(async (tx) => {
            // Step 1: Validate
            validatePackManifest(pack);
            // Step 2: Install agents
            agentIds = await installAgents(tx, companyId, pack.agents);
            // Step 3: Install skills
            await installSkills(tx, companyId, pack.skills, variables);
            // Step 4: Install quality gates
            await installQualityGates(tx, companyId, pack.qualityGates);
            // Step 5: Upsert company DNA
            if (pack.companyDna) {
                await installCompanyDna(tx, companyId, pack.companyDna);
            }
        });
    }
    catch (err) {
        const step = err instanceof PackValidationError ? 1 : 4;
        throw new PackInstallError(`Pack installation failed: ${err.message}`, step, err);
    }
    // Step 6: Schedule seed tasks (within 10 min)
    await scheduleSeedTasks(agentQueue, { companyId, seedTasks: pack.seedTasks, agentIds, variables });
    // Step 7: Register activation triggers
    await registerActivationTriggers(systemQueue, {
        companyId,
        packSlug: pack.slug,
        triggers: pack.activationSequence,
    });
    logger.info({ companyId, packSlug: pack.slug, agentIds }, "pack-installer: complete");
    return { success: true, agentIds, packSlug: pack.slug };
}
//# sourceMappingURL=installer.js.map