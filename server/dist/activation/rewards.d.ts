/**
 * server/src/activation/rewards.ts
 *
 * Approval micro-rewards — M11.
 *
 * After each task approval, a small encouraging message is injected inline
 * into the task thread. The message varies by:
 *   - Current approval streak (milestone messages at multiples of 10)
 *   - Rating quality (5★ = enthusiastic, 4★ = positive, 3★ = neutral)
 *
 * Messages are in French (RULE 9 — EMOTIONAL_LAYER.md section 7).
 * This file contains the message selection logic; actual delivery is via
 * the SSE layer (M15) or task thread endpoint.
 */
export interface MicroRewardContext {
    /** Star rating just submitted: 1–5 */
    rating: number;
    /** Consecutive 4+★ approvals (after counting the current one) */
    approvalStreak: number;
    /** Agent display name */
    agentName: string;
}
export interface MicroReward {
    message: string;
    isMilestone: boolean;
}
/**
 * Build the micro-reward message for an approval event.
 *
 * - Streak milestone (multiple of 10, rating ≥ 4) → milestone message
 * - 5★                                             → enthusiastic message
 * - 4★                                             → positive message
 * - ≤ 3★                                           → neutral message
 */
export declare function buildMicroRewardMessage(ctx: MicroRewardContext): MicroReward;
//# sourceMappingURL=rewards.d.ts.map