/**
 * server/src/billing/plans.ts
 *
 * Plan → limits mapping — M14.
 *
 * PLAN_LIMITS defines the hard resource caps per subscription tier.
 * applyPlanLimits() returns the DB update payload when a plan changes.
 *
 * Task translation is handled separately (M7): the UI shows usage in
 * human-readable units like "~95 CV batches remaining", not raw task counts.
 */
export const PLAN_LIMITS = {
    solo: { tasksPerMonth: 500, tokensPerMonth: 5_000_000, agents: 2 },
    growth: { tasksPerMonth: 2_000, tokensPerMonth: 20_000_000, agents: 6 },
    pro: { tasksPerMonth: 6_000, tokensPerMonth: 60_000_000, agents: 15 },
    enterprise: { tasksPerMonth: 99_999, tokensPerMonth: 999_000_000, agents: 999 },
};
export class UnknownPlanError extends Error {
    constructor(plan) {
        super(`Unknown plan: "${plan}". Valid plans: ${Object.keys(PLAN_LIMITS).join(", ")}`);
        this.name = "UnknownPlanError";
    }
}
/**
 * Returns the DB column values to write when a company's plan changes.
 * Throws UnknownPlanError for unrecognised plan slugs.
 */
export function applyPlanLimits(plan) {
    const limits = PLAN_LIMITS[plan];
    if (!limits)
        throw new UnknownPlanError(plan);
    return {
        plan,
        tasksLimitMonth: limits.tasksPerMonth,
        tokensLimitMonth: limits.tokensPerMonth,
    };
}
//# sourceMappingURL=plans.js.map