/**
 * server/src/improvement/analyser.ts
 *
 * Determines when and why to trigger skill self-improvement.
 *
 * Trigger conditions (either is sufficient):
 *   1. Trust score falls below 3.5 (M9 threshold for "supervised" floor)
 *   2. A damage-control event was recorded for this skill (M6)
 *
 * Once triggered, creates a draft skill_versions row.
 * The benchmark worker (M10) picks it up and runs golden-dataset evaluation.
 */
import type { Db } from "@paperclipai/db";
export declare const IMPROVEMENT_TRIGGER_SCORE = 3.5;
export type TriggerReason = "low_trust" | "damage_control" | "manual";
/**
 * Decide whether a new improvement cycle should start.
 *
 * @param trustScore    Current trust score for this agent+skill (0–5)
 * @param triggerReason Explicit reason supplied by the caller
 */
export declare function shouldTriggerImprovement(trustScore: number, triggerReason: TriggerReason | null): boolean;
export interface CreateDraftVersionParams {
    companyId: string;
    skillType: string;
    version: string;
    promptBody: string;
    frontmatter: Record<string, unknown>;
    parentVersionId?: string;
    createdByAgentId?: string;
    triggerReason: TriggerReason;
}
/**
 * Persist a draft skill version for benchmarking.
 * Returns the new version's id.
 */
export declare function createDraftVersion(db: Db, params: CreateDraftVersionParams): Promise<string>;
/**
 * Fetch the currently active skill version for a given skill type.
 * Returns null if no active version exists yet.
 */
export declare function getActiveVersion(db: Db, companyId: string, skillType: string): Promise<{
    id: string;
    benchmarkScore: string | null;
} | null>;
/**
 * Bump the patch or minor version number.
 * "1.0.0" → "1.1.0";  "1.9.0" → "1.10.0"
 */
export declare function bumpMinorVersion(current: string): string;
//# sourceMappingURL=analyser.d.ts.map