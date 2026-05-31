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

// ── Plan limits ───────────────────────────────────────────────────────────────

export interface PlanLimits {
  tasksPerMonth:  number;
  tokensPerMonth: number;
  /** Max concurrent agents for this plan */
  agents:         number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  solo:       { tasksPerMonth: 500,    tokensPerMonth: 5_000_000,   agents: 2   },
  growth:     { tasksPerMonth: 2_000,  tokensPerMonth: 20_000_000,  agents: 6   },
  pro:        { tasksPerMonth: 6_000,  tokensPerMonth: 60_000_000,  agents: 15  },
  enterprise: { tasksPerMonth: 99_999, tokensPerMonth: 999_000_000, agents: 999 },
} as const;

export class UnknownPlanError extends Error {
  constructor(plan: string) {
    super(`Unknown plan: "${plan}". Valid plans: ${Object.keys(PLAN_LIMITS).join(", ")}`);
    this.name = "UnknownPlanError";
  }
}

/**
 * Returns the DB column values to write when a company's plan changes.
 * Throws UnknownPlanError for unrecognised plan slugs.
 */
// Per-plan concurrent task caps (C4)
const CONCURRENCY_LIMITS: Record<string, number> = {
  solo:       2,
  growth:     5,
  pro:        10,
  enterprise: 25,
};

export function applyPlanLimits(plan: string): {
  plan:               string;
  tasksLimitMonth:    number;
  tokensLimitMonth:   number;
  maxConcurrentTasks: number;
} {
  const limits = PLAN_LIMITS[plan];
  if (!limits) throw new UnknownPlanError(plan);

  return {
    plan,
    tasksLimitMonth:    limits.tasksPerMonth,
    tokensLimitMonth:   limits.tokensPerMonth,
    maxConcurrentTasks: CONCURRENCY_LIMITS[plan] ?? 5,
  };
}
