/**
 * §31.4 Memory correctness + §31.5 Embedding depth tests.
 */

import { describe, it, expect } from "vitest";
import { PASS_THRESHOLD, COMPANY_THRESHOLD } from "../evals/memory-correctness.js";
import { computeEmbeddingScore, formatForCeoConsole } from "../analytics/embedding-depth.js";

// ── §31.4 Memory correctness ──────────────────────────────────────────────────

describe("§31.4 — memory correctness", () => {
  it("1. pass threshold is 0.85", () => {
    expect(PASS_THRESHOLD).toBe(0.85);
  });

  it("2. company threshold is 0.80", () => {
    expect(COMPANY_THRESHOLD).toBe(0.80);
  });

  it("3. match score 0.85 → passed", () => {
    expect(0.85 >= PASS_THRESHOLD).toBe(true);
  });

  it("4. match score 0.84 → failed", () => {
    expect(0.84 < PASS_THRESHOLD).toBe(true);
  });

  it("5. avg score 0.80 → exactly at company threshold (passes)", () => {
    expect(0.80 >= COMPANY_THRESHOLD).toBe(true);
  });

  it("6. avg score 0.79 → needs review", () => {
    expect(0.79 < COMPANY_THRESHOLD).toBe(true);
  });
});

// ── §31.5 Embedding depth ─────────────────────────────────────────────────────

describe("§31.5 — embedding depth score", () => {
  it("7. max score is 100 (all dimensions maxed)", () => {
    const score = computeEmbeddingScore({
      taskCount:         50,
      workflowTypes:     8,
      autonomousTaskPct: 100,
      timeSavedHours:    10,
    });
    expect(score).toBe(100);
  });

  it("8. zero activity → score is 0", () => {
    const score = computeEmbeddingScore({
      taskCount:         0,
      workflowTypes:     0,
      autonomousTaskPct: 0,
      timeSavedHours:    0,
    });
    expect(score).toBe(0);
  });

  it("9. score is bounded 0–100", () => {
    const score = computeEmbeddingScore({
      taskCount:         1000,
      workflowTypes:     100,
      autonomousTaskPct: 200,
      timeSavedHours:    1000,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("10. each dimension contributes max 25 points", () => {
    // Only task volume maxed
    const score = computeEmbeddingScore({
      taskCount:         50,
      workflowTypes:     0,
      autonomousTaskPct: 0,
      timeSavedHours:    0,
    });
    expect(score).toBe(25);
  });

  it("11. partial completion scores proportionally", () => {
    // 25 tasks = 50% of max → 12.5 pts, rounded to 13
    const score = computeEmbeddingScore({
      taskCount:         25,
      workflowTypes:     0,
      autonomousTaskPct: 0,
      timeSavedHours:    0,
    });
    expect(score).toBe(13); // Math.round(12.5)
  });
});

// ── §31.5 CEO Console display ────��────────────────────────────────────────────

describe("§31.5 — formatForCeoConsole", () => {
  it("12. never returns raw score number", () => {
    for (const score of [0, 20, 40, 60, 80, 100]) {
      const text = formatForCeoConsole(score);
      expect(text).not.toMatch(/\b\d+\/100\b/);
    }
  });

  it("13. low score returns encouraging message", () => {
    const text = formatForCeoConsole(10);
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(10);
  });

  it("14. high score returns positive message", () => {
    const text = formatForCeoConsole(80);
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(10);
  });

  it("15. mid score contains percentage", () => {
    const text = formatForCeoConsole(34);
    expect(text).toContain("34%");
  });
});
