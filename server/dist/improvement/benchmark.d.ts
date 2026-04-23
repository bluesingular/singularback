/**
 * server/src/improvement/benchmark.ts
 *
 * Golden-dataset benchmarking for skill versions.
 *
 * Flow:
 *   1. Load all golden_dataset items for this skill type.
 *   2. For each item, call scoreFn(input, expectedOutput) → score 1–5.
 *   3. Average the scores → newVersionScore.
 *   4. Compare to currentVersionScore with ±5% threshold:
 *        new ≥ current × 1.05  →  "proceed"   (activate or propose)
 *        new <  current × 0.95  →  "block"     (revert, keep as draft)
 *        otherwise              →  "neutral"   (activate at parity)
 *   5. Persist benchmark results on the skill_versions row.
 *
 * The scoreFn is injected by the caller — in production it calls the LLM
 * to evaluate quality; in tests it is a simple mock.
 *
 * RULE: benchmark MUST run before any call to activateSkillVersion().
 */
import type { Db } from "@paperclipai/db";
/** Minimum improvement (relative) required to proceed with activation */
export declare const BENCHMARK_PROCEED_THRESHOLD = 0.05;
/** Maximum regression (relative) allowed before blocking */
export declare const BENCHMARK_BLOCK_THRESHOLD = 0.05;
export type BenchmarkDecision = "proceed" | "block" | "neutral";
/** Returns a quality score 1–5 for a single golden-dataset item */
export type ScoreFn = (input: unknown, expectedOutput: unknown) => Promise<number>;
export interface BenchmarkResult {
    newScore: number;
    currentScore: number;
    itemCount: number;
    decision: BenchmarkDecision;
}
/**
 * Determine the activation decision given two benchmark scores.
 * Pure function — no DB access.
 */
export declare function evaluateBenchmarkDecision(newScore: number, currentScore: number): BenchmarkDecision;
export interface RunBenchmarkParams {
    companyId: string;
    skillType: string;
    draftVersionId: string;
    currentScore: number;
    scoreFn: ScoreFn;
}
/**
 * Run the golden-dataset benchmark for a draft skill version.
 * Updates the skill_versions row with the result and returns the decision.
 *
 * Returns null if no golden dataset items exist (cannot benchmark — caller decides).
 */
export declare function runBenchmark(db: Db, params: RunBenchmarkParams): Promise<BenchmarkResult | null>;
//# sourceMappingURL=benchmark.d.ts.map