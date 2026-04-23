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
import { eq, and } from "drizzle-orm";
import { goldenDatasets, skillVersions } from "@paperclipai/db";
// ── Constants ─────────────────────────────────────────────────────────────────
/** Minimum improvement (relative) required to proceed with activation */
export const BENCHMARK_PROCEED_THRESHOLD = 0.05; // +5%
/** Maximum regression (relative) allowed before blocking */
export const BENCHMARK_BLOCK_THRESHOLD = 0.05; // -5%
// ── Decision logic ────────────────────────────────────────────────────────────
/**
 * Determine the activation decision given two benchmark scores.
 * Pure function — no DB access.
 */
export function evaluateBenchmarkDecision(newScore, currentScore) {
    // No prior baseline — anything above zero can proceed
    if (currentScore === 0) {
        return newScore > 0 ? "proceed" : "neutral";
    }
    if (newScore >= currentScore * (1 + BENCHMARK_PROCEED_THRESHOLD)) {
        return "proceed";
    }
    if (newScore < currentScore * (1 - BENCHMARK_BLOCK_THRESHOLD)) {
        return "block";
    }
    return "neutral";
}
/**
 * Run the golden-dataset benchmark for a draft skill version.
 * Updates the skill_versions row with the result and returns the decision.
 *
 * Returns null if no golden dataset items exist (cannot benchmark — caller decides).
 */
export async function runBenchmark(db, params) {
    const { companyId, skillType, draftVersionId, currentScore, scoreFn } = params;
    // 1. Load golden dataset
    const items = await db
        .select()
        .from(goldenDatasets)
        .where(and(eq(goldenDatasets.companyId, companyId), eq(goldenDatasets.skillType, skillType)));
    if (items.length === 0)
        return null;
    // 2. Score each item
    const scores = [];
    for (const item of items) {
        const score = await scoreFn(item.input, item.expectedOutput);
        scores.push(Math.min(5, Math.max(1, score)));
    }
    const newScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const decision = evaluateBenchmarkDecision(newScore, currentScore);
    // 3. Persist results on the draft version row
    const nextStatus = decision === "block"
        ? "blocked"
        : decision === "proceed"
            ? "draft" // stays draft until activate step confirms Tier A/B decision
            : "draft";
    await db
        .update(skillVersions)
        .set({
        benchmarkScore: String(Math.round(newScore * 100) / 100),
        benchmarkItemCount: items.length,
        status: nextStatus,
    })
        .where(eq(skillVersions.id, draftVersionId));
    return {
        newScore: Math.round(newScore * 100) / 100,
        currentScore,
        itemCount: items.length,
        decision,
    };
}
//# sourceMappingURL=benchmark.js.map