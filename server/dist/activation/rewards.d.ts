/**
 * server/src/activation/rewards.ts
 *
 * Approval micro-rewards — M11.
 *
 * After each task approval, a small encouraging message is injected inline
 * into the task thread. The message varies by:
 *   - Current approval streak (milestone messages at multiples of 10)
 *   - Rating quality (5★ = enthusiastic, 4★ = positive, 3★ = neutral)
 *   - Company locale (fr | en)
 *
 * Messages are sourced from EMOTIONAL_LAYER.md §7.
 */
export interface MicroRewardContext {
    /** Star rating just submitted: 1–5 */
    rating: number;
    /** Consecutive 4+★ approvals (after counting the current one) */
    approvalStreak: number;
    /** Agent display name */
    agentName: string;
    /** Company locale — defaults to 'fr' */
    locale?: string;
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