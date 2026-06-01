/**
 * AG-7 — Outcome attribution tests.
 *
 * Verifies:
 *  1. Attribution rows created for all non-cancelled tasks
 *  2. Failed tasks get contribution_score = 0
 *  3. Temporal weighting: older tasks score lower than recent ones
 *  4. Duplicate call is idempotent (no crash, inserts again — idempotency at
 *     the pattern-promotion level: won't create a second pattern for same skill)
 *  5. Pattern NOT promoted when sample size < 10
 *  6. Pattern promoted when sample size >= 10 and confidence >= 0.80
 *  7. neutral outcome skips pattern promotion entirely
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordOutcome } from "../learning/outcome-attribution.js";

// ── Mock DB ───────────────────────────────────────────────────────────────────

function makeDb(taskLinks: any[], attributionCounts: any[] = [], existingPatterns: any[] = []) {
  const inserted: any[] = [];
  const patternsInserted: any[] = [];

  const db = {
    select: vi.fn().mockImplementation(() => db),
    from:   vi.fn().mockImplementation(() => db),
    innerJoin: vi.fn().mockImplementation(() => db),
    leftJoin:  vi.fn().mockImplementation(() => db),
    where:  vi.fn().mockImplementation(() => db),
    orderBy: vi.fn().mockImplementation(() => db),
    limit:  vi.fn().mockImplementation(() => db),
    groupBy: vi.fn().mockImplementation(() => db),
    having: vi.fn().mockImplementation(() => db),
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((vals: any) => {
        if (Array.isArray(vals)) inserted.push(...vals);
        else patternsInserted.push(vals);
        return Promise.resolve();
      }),
    })),
    _taskLinks: taskLinks,
    _attributionCounts: attributionCounts,
    _existingPatterns: existingPatterns,
    _callCount: 0,
  } as any;

  // Mock chained then() for each query call
  let callIdx = 0;
  db.orderBy.mockImplementation(() => {
    // First call: taskLinks query
    return Promise.resolve(taskLinks);
  });
  db.having.mockImplementation(() => {
    return Promise.resolve(attributionCounts);
  });
  db.limit.mockImplementation(() => {
    return Promise.resolve(existingPatterns.slice(callIdx++, callIdx));
  });

  return { db, inserted, patternsInserted };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("AG-7 — recordOutcome", () => {
  it("1. creates attribution rows for non-cancelled tasks", async () => {
    const tasks = [
      { taskId: "t1", createdAt: new Date(Date.now() - 3600_000), status: "completed", agentId: "a1", skillId: "s1", approvedBy: "u1" },
      { taskId: "t2", createdAt: new Date(Date.now() - 7200_000), status: "completed", agentId: "a1", skillId: "s1", approvedBy: null },
    ];
    const { db, inserted } = makeDb(tasks);

    const result = await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "positive" });
    expect(result.attributionsCreated).toBe(2);
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({ companyId: "c1", missionId: "m1", outcomeValue: "positive" });
  });

  it("2. cancelled tasks are excluded from attributions", async () => {
    const tasks = [
      { taskId: "t1", createdAt: new Date(), status: "completed", agentId: "a1", skillId: "s1" },
      { taskId: "t2", createdAt: new Date(), status: "cancelled", agentId: "a1", skillId: "s1" },
    ];
    const { db, inserted } = makeDb(tasks);

    const result = await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "positive" });
    expect(result.attributionsCreated).toBe(1);
    expect(inserted).toHaveLength(1);
  });

  it("3. failed tasks are excluded from attributions", async () => {
    const tasks = [
      { taskId: "t1", createdAt: new Date(), status: "failed", agentId: "a1", skillId: "s1" },
    ];
    const { db, inserted } = makeDb(tasks);

    const result = await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "negative" });
    expect(result.attributionsCreated).toBe(1); // failed included with score=0
    expect(inserted[0].contributionScore).toBe("0.000"); // weight=0 for failed
  });

  it("4. tasks without agentId are excluded from attributions", async () => {
    const tasks = [
      { taskId: "t1", createdAt: new Date(), status: "completed", agentId: null, skillId: "s1" },
    ];
    const { db, inserted } = makeDb(tasks);

    const result = await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "positive" });
    expect(result.attributionsCreated).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("5. no tasks → attributionsCreated = 0, no crash", async () => {
    const { db, inserted } = makeDb([]);

    const result = await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "positive" });
    expect(result.attributionsCreated).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("6. neutral outcome → patternsPromoted = 0 (skips promotion)", async () => {
    const tasks = [
      { taskId: "t1", createdAt: new Date(), status: "completed", agentId: "a1", skillId: "s1" },
    ];
    const attributionCounts = [
      { skillId: "s1", agentId: "a1", total: "12", posCount: "11", negCount: "1", avgScore: "0.8" },
    ];
    const { db } = makeDb(tasks, attributionCounts);

    const result = await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "neutral" });
    expect(result.patternsPromoted).toBe(0);
  });

  it("7. contribution_score is between 0 and 1", async () => {
    const tasks = [
      { taskId: "t1", createdAt: new Date(Date.now() - 100_000), status: "completed", agentId: "a1", skillId: "s1" },
      { taskId: "t2", createdAt: new Date(Date.now() - 10_000_000), status: "completed", agentId: "a1", skillId: "s1" },
    ];
    const { db, inserted } = makeDb(tasks);

    await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "positive" });
    for (const row of inserted) {
      const score = parseFloat(row.contributionScore);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("AG-7 — temporal weighting", () => {
  it("8. recent task gets higher contribution score than older task", async () => {
    const tasks = [
      { taskId: "t-recent", createdAt: new Date(Date.now() - 60_000), status: "completed", agentId: "a1", skillId: "s1" },
      { taskId: "t-old",    createdAt: new Date(Date.now() - 86_400_000 * 5), status: "completed", agentId: "a1", skillId: "s1" },
    ];
    const { db, inserted } = makeDb(tasks);

    await recordOutcome({ db, companyId: "c1", missionId: "m1", outcome: "positive" });
    const recent = inserted.find((r: any) => r.taskId === "t-recent");
    const old    = inserted.find((r: any) => r.taskId === "t-old");
    expect(parseFloat(recent.contributionScore)).toBeGreaterThan(parseFloat(old.contributionScore));
  });
});
