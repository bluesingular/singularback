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
export interface PlanLimits {
    tasksPerMonth: number;
    tokensPerMonth: number;
    /** Max concurrent agents for this plan */
    agents: number;
}
export declare const PLAN_LIMITS: Record<string, PlanLimits>;
export declare class UnknownPlanError extends Error {
    constructor(plan: string);
}
/**
 * Returns the DB column values to write when a company's plan changes.
 * Throws UnknownPlanError for unrecognised plan slugs.
 */
export declare function applyPlanLimits(plan: string): {
    plan: string;
    tasksLimitMonth: number;
    tokensLimitMonth: number;
};
//# sourceMappingURL=plans.d.ts.map