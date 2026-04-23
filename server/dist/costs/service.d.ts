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
import type { Db } from "@paperclipai/db";
export declare const MODEL_COSTS: Record<string, {
    input: number;
    output: number;
}>;
export declare class BudgetExhaustedError extends Error {
    constructor(message: string);
}
/**
 * Calculate cost in micro-euros for a given model and token counts.
 * Returns 0 for unknown models (safe default — don't crash, log separately).
 */
export declare function calculateCostMicro(model: string, inputTokens: number, outputTokens: number): number;
/**
 * Return the current billing month as 'YYYY-MM'.
 */
export declare function currentBillingMonth(): string;
export interface RecordUsageParams {
    companyId: string;
    agentId: string;
    taskId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    tier: 0 | 1 | 2 | 3;
}
/**
 * Record LLM token usage and update company running counters.
 * Called after every successful LLM invocation.
 */
export declare function recordUsage(db: Db, params: RecordUsageParams): Promise<void>;
/**
 * Hard stop — call before every LLM invocation.
 * Throws BudgetExhaustedError if the company has hit its monthly task or token limit.
 */
export declare function checkBudgetBeforeCall(db: Db, companyId: string): Promise<void>;
//# sourceMappingURL=service.d.ts.map