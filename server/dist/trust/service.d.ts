/**
 * server/src/trust/service.ts
 *
 * Trust calibration service — M9.
 *
 * recordApproval()     — called after each task approval rating is submitted.
 *                         Updates trust score, streak, and triggers proposals.
 * checkTrustDowngrade() — called after a gate violation or damage-control event.
 *                         Downgrades autonomy level if score dropped.
 *
 * RULE (Tier A, never auto-activates):
 *   When autonomyTier = "A", any autonomy upgrade MUST go through a human-approved
 *   trust_proposals record. The agent never gains autonomy automatically.
 *   When autonomyTier = "B", upgrades activate automatically when the streak fires.
 */
import type { Db } from "@paperclipai/db";
import { type AutonomyLevel } from "./calculator.js";
export declare const STREAK_THRESHOLD = 10;
export interface RecordApprovalParams {
    companyId: string;
    agentId: string;
    skillType: string;
    /** From skill frontmatter — "A" requires human approval for any upgrade */
    skillAutonomyTier: "A" | "B";
    /** Star rating submitted by operator: 1–5 */
    rating: number;
    /** Whether all quality gates passed for this task */
    gatePassed: boolean;
    /** Whether output schema validation passed for this task */
    schemaPassed: boolean;
    /** Rolling 30-day metrics (caller computes from audit log) */
    qualityRatingAvg: number;
    gatePassRate: number;
    schemaPassRate: number;
    taskCountWindow: number;
    /** Current streak from the trust_scores row (0 if first task) */
    currentStreak: number;
    /** Current autonomy level from the trust_scores row */
    currentLevel: AutonomyLevel;
}
export interface RecordApprovalResult {
    newScore: number;
    newLevel: AutonomyLevel;
    newStreak: number;
    proposalCreated: boolean;
    autoActivated: boolean;
}
/**
 * Process a task approval rating.
 *
 * 1. Compute new trust score from rolling metrics.
 * 2. Update streak (reset on < 4★, increment on ≥ 4★).
 * 3. If streak reaches STREAK_THRESHOLD:
 *    - Tier A → create trust_proposal (human must approve)
 *    - Tier B → auto-activate next level immediately
 * 4. Upsert trust_scores row.
 */
export declare function recordApproval(db: Db, params: RecordApprovalParams): Promise<RecordApprovalResult>;
export interface CheckDowngradeParams {
    companyId: string;
    agentId: string;
    skillType: string;
    currentLevel: AutonomyLevel;
    newScore: number;
}
export interface CheckDowngradeResult {
    downgraded: boolean;
    newLevel: AutonomyLevel;
}
/**
 * Check if a new trust score warrants a downgrade.
 * Called after gate violations or damage-control events.
 *
 * If downgraded, updates the trust_scores row and fires a notification stub.
 */
export declare function checkTrustDowngrade(db: Db, params: CheckDowngradeParams): Promise<CheckDowngradeResult>;
//# sourceMappingURL=service.d.ts.map