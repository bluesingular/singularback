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
import type { Db } from "@paperclipai/db";
export type TriggerKey = "day_0_seed" | "day_2_first_task" | "day_4_milestone" | "day_6_relationship" | "day_7_summary";
export interface ActivationTrigger {
    key: TriggerKey;
    /** Days since pack installation — trigger fires at or after this day */
    dayThreshold: number;
    /** Human-readable description (internal use only; copy in EMOTIONAL_LAYER.md) */
    description: string;
    /** Pure predicate — returns true when the trigger condition is met */
    condition: (state: ActivationState) => boolean;
}
export interface ActivationState {
    /** Days elapsed since pack installation (fractional OK) */
    daysSinceInstall: number;
    /** Total tasks completed by agents since installation */
    tasksCompleted: number;
    /** Whether the Day 0 seed task has been scheduled (set by M12 installer) */
    seedTaskScheduled: boolean;
    /** Total contacts engaged (events logged) since installation */
    contactsEngaged: number;
}
export declare const STANDARD_TRIGGERS: ActivationTrigger[];
/**
 * Check whether a single activation trigger should fire given the current state.
 * Pure function — no side effects, no DB access.
 */
export declare function checkActivationTrigger(trigger: ActivationTrigger, state: ActivationState): boolean;
/**
 * Return all triggers from the list that should fire for the given state.
 * Excludes triggers that have already been recorded as fired.
 */
export declare function pendingTriggers(triggers: ActivationTrigger[], state: ActivationState, alreadyFired: Set<TriggerKey>): ActivationTrigger[];
/**
 * Record that an activation trigger has fired for a company + pack.
 * Uses INSERT … ON CONFLICT DO NOTHING to be idempotent (RULE 6).
 */
export declare function recordActivationFired(db: Db, companyId: string, packSlug: string, triggerKey: TriggerKey): Promise<void>;
/**
 * Return the set of trigger keys already fired for a company + pack.
 */
export declare function getFiredTriggers(db: Db, companyId: string, packSlug: string): Promise<Set<TriggerKey>>;
//# sourceMappingURL=sequence.d.ts.map