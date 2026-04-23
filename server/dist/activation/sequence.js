/**
 * server/src/activation/sequence.ts
 *
 * Activation sequence — 5 trigger definitions per pack (M11).
 *
 * The activation sequence drives the first-week experience:
 *   Day 0: Seed tasks fire within 10 minutes of installation (M12)
 *   Day 2: First real task completes → "Votre premier travail automatisé"
 *   Day 4: Milestone reached         → trust / usage milestone card
 *   Day 6: Relationship event        → contact engagement milestone
 *   Day 7: Week summary              → weekly summary card
 *
 * checkActivationTrigger() is a pure function — no DB access, easy to test.
 * recordActivationFired()  writes the activation_moments row.
 *
 * Notification copy comes from EMOTIONAL_LAYER.md (applied in M13 UI layer).
 */
import { eq, and } from "drizzle-orm";
import { activationMoments } from "@paperclipai/db";
// ── Standard trigger definitions (used by all packs unless overridden) ────────
export const STANDARD_TRIGGERS = [
    {
        key: "day_0_seed",
        dayThreshold: 0,
        description: "Seed tasks scheduled at installation",
        condition: (s) => s.seedTaskScheduled,
    },
    {
        key: "day_2_first_task",
        dayThreshold: 2,
        description: "First real task completed by an agent",
        condition: (s) => s.daysSinceInstall >= 2 && s.tasksCompleted >= 1,
    },
    {
        key: "day_4_milestone",
        dayThreshold: 4,
        description: "Usage milestone — 5+ tasks completed",
        condition: (s) => s.daysSinceInstall >= 4 && s.tasksCompleted >= 5,
    },
    {
        key: "day_6_relationship",
        dayThreshold: 6,
        description: "Relationship milestone — first contact engaged",
        condition: (s) => s.daysSinceInstall >= 6 && s.contactsEngaged >= 1,
    },
    {
        key: "day_7_summary",
        dayThreshold: 7,
        description: "First-week summary",
        condition: (s) => s.daysSinceInstall >= 7,
    },
];
// ── Pure trigger check ────────────────────────────────────────────────────────
/**
 * Check whether a single activation trigger should fire given the current state.
 * Pure function — no side effects, no DB access.
 */
export function checkActivationTrigger(trigger, state) {
    return trigger.condition(state);
}
/**
 * Return all triggers from the list that should fire for the given state.
 * Excludes triggers that have already been recorded as fired.
 */
export function pendingTriggers(triggers, state, alreadyFired) {
    return triggers.filter((t) => !alreadyFired.has(t.key) && checkActivationTrigger(t, state));
}
// ── DB persistence ────────────────────────────────────────────────────────────
/**
 * Record that an activation trigger has fired for a company + pack.
 * Uses INSERT … ON CONFLICT DO NOTHING to be idempotent (RULE 6).
 */
export async function recordActivationFired(db, companyId, packSlug, triggerKey) {
    await db
        .insert(activationMoments)
        .values({
        companyId,
        packSlug,
        triggerKey,
        fired: true,
        firedAt: new Date(),
    })
        .onConflictDoNothing();
}
/**
 * Return the set of trigger keys already fired for a company + pack.
 */
export async function getFiredTriggers(db, companyId, packSlug) {
    const rows = await db
        .select({ triggerKey: activationMoments.triggerKey })
        .from(activationMoments)
        .where(and(eq(activationMoments.companyId, companyId), eq(activationMoments.packSlug, packSlug), eq(activationMoments.fired, true)));
    return new Set(rows.map((r) => r.triggerKey));
}
//# sourceMappingURL=sequence.js.map