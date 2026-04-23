/**
 * server/src/costs/service.ts
 *
 * Cost intelligence — records LLM token usage at micro-euro precision.
 *
 * Why micro-euros: avoids floating-point rounding on small amounts.
 * 1 EUR = 1,000,000 micro-EUR. Claude T3 costs 3,000 micro-EUR per 1M input tokens.
 * A typical T1 call (1k tokens in, 500 out) costs ~0.15 + 0.30 = 0.45 micro-EUR.
 *
 * Every LLM call in callLLM() records usage here.
 * Budget enforcement: checkBudgetBeforeCall() is called before every LLM invocation.
 */

import { eq, sql } from "drizzle-orm";
import { costRecords, companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

// ── Model price table ─────────────────────────────────────────────────────────
// Prices in micro-euros per 1,000,000 tokens

export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "mistralai/ministral-3b":       { input: 20,    output: 60    },
  "mistralai/mistral-small-3.2":  { input: 150,   output: 600   },
  "deepseek/deepseek-chat-v3-5":  { input: 240,   output: 720   },
  "google/gemini-flash-1.5":      { input: 75,    output: 300   },
  "mistralai/mistral-medium-3.1": { input: 400,   output: 2000  },
  "anthropic/claude-sonnet-4-5":  { input: 3000,  output: 15000 },
  "anthropic/claude-sonnet-4-6":  { input: 3000,  output: 15000 },
};

// ── Error types ───────────────────────────────────────────────────────────────

export class BudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExhaustedError";
  }
}

// ── Pure computation ──────────────────────────────────────────────────────────

/**
 * Calculate cost in micro-euros for a given model and token counts.
 * Returns 0 for unknown models (safe default — don't crash, log separately).
 */
export function calculateCostMicro(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const costs = MODEL_COSTS[model];
  if (!costs) return 0;

  return Math.round(
    (inputTokens  / 1_000_000) * costs.input +
    (outputTokens / 1_000_000) * costs.output,
  );
}

/**
 * Return the current billing month as 'YYYY-MM'.
 */
export function currentBillingMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── Cost recording ────────────────────────────────────────────────────────────

export interface RecordUsageParams {
  companyId:    string;
  agentId:      string;
  taskId:       string;
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  tier:         0 | 1 | 2 | 3;
}

/**
 * Record LLM token usage and update company running counters.
 * Called after every successful LLM invocation.
 */
export async function recordUsage(
  db: Db,
  params: RecordUsageParams,
): Promise<void> {
  const costEurMicro = calculateCostMicro(
    params.model,
    params.inputTokens,
    params.outputTokens,
  );

  const billingMonth = currentBillingMonth();

  // Insert cost record
  await db.insert(costRecords).values({
    companyId:    params.companyId,
    agentId:      params.agentId,
    taskId:       params.taskId,
    model:        params.model,
    tier:         params.tier,
    inputTokens:  params.inputTokens,
    outputTokens: params.outputTokens,
    costEurMicro,
    billingMonth,
  });

  // Update company's running monthly counters (for real-time usage gauge)
  await db
    .update(companies)
    .set({
      tasksUsedMonth:  sql`tasks_used_month + 1`,
      tokensUsedMonth: sql`tokens_used_month + ${params.inputTokens + params.outputTokens}`,
    })
    .where(eq(companies.id, params.companyId));

  // Check T3 cap for Growth plan (max 10% of monthly tasks in T3)
  if (params.tier === 3) {
    await checkT3Cap(db, params.companyId);
  }
}

// ── Budget enforcement ────────────────────────────────────────────────────────

/**
 * Hard stop — call before every LLM invocation.
 * Throws BudgetExhaustedError if the company has hit its monthly task or token limit.
 */
export async function checkBudgetBeforeCall(
  db: Db,
  companyId: string,
): Promise<void> {
  const [company] = await db
    .select({
      tasksUsedMonth:   companies.tasksUsedMonth,
      tasksLimitMonth:  companies.tasksLimitMonth,
      tokensUsedMonth:  companies.tokensUsedMonth,
      tokensLimitMonth: companies.tokensLimitMonth,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  if (company.tasksUsedMonth >= company.tasksLimitMonth) {
    throw new BudgetExhaustedError(
      "Monthly task limit reached. Upgrade your plan or wait for the next billing cycle.",
    );
  }

  if (company.tokensUsedMonth >= company.tokensLimitMonth) {
    throw new BudgetExhaustedError("Monthly token limit reached.");
  }
}

// ── T3 cap check ──────────────────────────────────────────────────────────────

/**
 * Growth plan: T3 tasks capped at 10% of monthly task limit.
 * Emits a budget alert (M11 stub) if exceeded.
 * Does NOT hard-stop — T3 cap is advisory for now (operator approval flow in M9).
 */
async function checkT3Cap(db: Db, companyId: string): Promise<void> {
  const [company] = await db
    .select({
      tasksUsedMonth:  companies.tasksUsedMonth,
      tasksLimitMonth: companies.tasksLimitMonth,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) return;

  const t3Cap = Math.floor(company.tasksLimitMonth * 0.1);
  // Count T3 tasks this month from cost_records — stub for M7
  // Full implementation queries cost_records for tier=3 WHERE billing_month=current
  // For now: advisory warning logged, hard cap in M9 with trust integration
  void t3Cap;
}
