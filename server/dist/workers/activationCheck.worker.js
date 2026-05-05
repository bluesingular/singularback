/**
 * server/src/workers/activationCheck.worker.ts
 *
 * Processes "activation.check" jobs from the system queue.
 *
 * The pack installer schedules one job per activation trigger (5 total) with
 * a delay equal to the trigger's dayThreshold × 24h. When the job matures,
 * this worker evaluates whether the trigger condition is met and, if so:
 *   1. Records the trigger as fired (idempotent via ON CONFLICT DO NOTHING)
 *   2. Inserts an intelligence card visible on the operator's dashboard
 *
 * If the condition is not met (e.g., not enough tasks completed yet for the
 * day_4_milestone), the trigger is skipped — it was a time-based check, not
 * a guaranteed delivery. This is intentional: the activation sequence rewards
 * operators who engage with the platform, not idle accounts.
 *
 * RULE 6: BullMQ idempotency — jobId deduplication ensures each trigger is
 * attempted at most once per company+pack combination.
 */
import { Worker } from "bullmq";
import { eq, and, count, isNotNull, sql } from "drizzle-orm";
import pino from "pino";
import { companies, issues, contactEvents, intelligenceCards } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { STANDARD_TRIGGERS, getFiredTriggers, recordActivationFired, } from "../activation/sequence.js";
const logger = pino({ name: "activation-check-worker" });
// ── Activation state resolver ─────────────────────────────────────────────────
async function resolveActivationState(db, companyId) {
    // Use company created_at as install-time proxy
    const [company] = await db
        .select({ createdAt: companies.createdAt })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
    const installTime = company?.createdAt ?? new Date();
    const msElapsed = Date.now() - installTime.getTime();
    const daysSinceInstall = msElapsed / (24 * 60 * 60 * 1000);
    // Count completed tasks (issues with completedAt set)
    const [taskRow] = await db
        .select({ total: count() })
        .from(issues)
        .where(and(eq(issues.companyId, companyId), isNotNull(issues.completedAt)));
    const tasksCompleted = Number(taskRow?.total ?? 0);
    // Count distinct contacts engaged (has at least one event)
    const [contactRow] = await db
        .select({ total: sql `count(distinct ${contactEvents.contactId})` })
        .from(contactEvents)
        .where(eq(contactEvents.companyId, companyId));
    const contactsEngaged = Number(contactRow?.total ?? 0);
    // seedTaskScheduled: true if day_0_seed has already been recorded
    const firedSoFar = await getFiredTriggers(db, companyId, "p1-recruitment");
    const seedTaskScheduled = firedSoFar.has("day_0_seed");
    return { daysSinceInstall, tasksCompleted, contactsEngaged, seedTaskScheduled };
}
// ── Card content per trigger ──────────────────────────────────────────────────
const ACTIVATION_CARDS = {
    day_0_seed: {
        title: "Sophie a qualifié vos premiers CV",
        body: "Vos agents ont démarré. 5 CV analysés, 2 profils recommandés en attente de votre validation.",
        urgency: 4,
    },
    day_2_first_task: {
        title: "Votre première tâche automatisée",
        body: "Sophie a terminé sa première mission réelle. Consultez les résultats et notez son travail.",
        urgency: 3,
    },
    day_4_milestone: {
        title: "Votre équipe IA détecte des signaux marché",
        body: "Sophie a repéré plusieurs candidats issus du même secteur — signal à exploiter pour votre prochain sourcing.",
        urgency: 2,
    },
    day_6_relationship: {
        title: "3 candidats attendent une réponse",
        body: "Julien a préparé des messages de relance pour 3 candidats sans réponse depuis plus de 7 jours.",
        urgency: 3,
    },
    day_7_summary: {
        title: "Bilan de votre première semaine",
        body: "Votre équipe IA a complété ses premières missions. Consultez le rapport pour voir le détail.",
        urgency: 2,
    },
};
// ── Worker factory (exported separately so tests can inject db) ───────────────
export function createActivationCheckWorker(db) {
    return new Worker("system", async (job) => {
        if (job.name !== "activation.check")
            return;
        const { companyId, packSlug, triggerKey } = job.data;
        logger.info({ companyId, packSlug, triggerKey }, "activation-check: evaluating");
        // Guard: already fired?
        const fired = await getFiredTriggers(db, companyId, packSlug);
        if (fired.has(triggerKey)) {
            logger.info({ companyId, triggerKey }, "activation-check: already fired, skipping");
            return;
        }
        // Resolve current activation state
        const state = await resolveActivationState(db, companyId);
        // Find trigger definition
        const trigger = STANDARD_TRIGGERS.find((t) => t.key === triggerKey);
        if (!trigger) {
            logger.warn({ triggerKey }, "activation-check: unknown trigger key");
            return;
        }
        // Evaluate condition
        const shouldFire = trigger.condition(state);
        if (!shouldFire) {
            logger.info({ companyId, triggerKey, state }, "activation-check: condition not met, skipping");
            return;
        }
        // Record trigger fired (idempotent)
        await recordActivationFired(db, companyId, packSlug, triggerKey);
        // Insert intelligence card
        const card = ACTIVATION_CARDS[triggerKey];
        if (card) {
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            await db
                .insert(intelligenceCards)
                .values({
                companyId,
                cardType: "activation",
                title: card.title,
                body: card.body,
                urgency: card.urgency,
                insightKey: `activation:${triggerKey}`,
                expiresAt,
            })
                .onConflictDoNothing();
            logger.info({ companyId, triggerKey, cardTitle: card.title }, "activation-check: intelligence card inserted");
        }
    }, {
        connection: redisConnectionBlocking,
        concurrency: 5,
    });
}
// ── Singleton worker (bound to db at app startup via init) ────────────────────
let _worker = null;
export function initActivationCheckWorker(db) {
    if (_worker)
        return _worker;
    _worker = createActivationCheckWorker(db);
    _worker.on("failed", (job, err) => {
        logger.error({ companyId: job?.data?.companyId, triggerKey: job?.data?.triggerKey, err }, "activation.check job failed");
    });
    _worker.on("error", (err) => {
        logger.error({ err }, "activation-check worker connection error");
    });
    return _worker;
}
//# sourceMappingURL=activationCheck.worker.js.map