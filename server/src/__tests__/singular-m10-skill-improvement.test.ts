/**
 * M10 — Skill versioning + self-improvement + evaluation framework
 *
 * Tests:
 *  1.  shouldTriggerImprovement: trust score 3.4 (< 3.5) → true
 *  2.  shouldTriggerImprovement: trust score 3.6, no damage control → false
 *  3.  shouldTriggerImprovement: trust score 4.0 + damage_control reason → true
 *  4.  shouldTriggerImprovement: manual trigger always fires
 *  5.  evaluateBenchmarkDecision: new 4.3 vs current 4.0 (+7.5%) → "proceed"
 *  6.  evaluateBenchmarkDecision: new 3.7 vs current 4.0 (-7.5%) → "block"
 *  7.  evaluateBenchmarkDecision: new 4.1 vs current 4.0 (+2.5%) → "neutral"
 *  8.  evaluateBenchmarkDecision: currentScore=0, newScore>0 → "proceed"
 *  9.  runBenchmark: scores all golden items, persists score, returns decision
 * 10.  runBenchmark: no golden items → returns null (cannot benchmark)
 * 11.  triggerImprovement: trust 3.2 → draft version created, returns id
 * 12.  triggerImprovement: trust 3.8, no reason → not triggered
 * 13.  activateSkillVersion: Tier A + proceed → "pending_approval", NOT activated
 * 14.  activateSkillVersion: Tier B + proceed → auto-activated ("active")
 * 15.  activateSkillVersion: block decision → "blocked" regardless of tier
 * 16.  activateSkillVersion: throws if benchmark not yet run (benchmarkScore=null)
 * 17.  bumpMinorVersion: "1.0.0" → "1.1.0"; "1.9.0" → "1.10.0"
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  shouldTriggerImprovement,
  createDraftVersion,
  getActiveVersion,
  bumpMinorVersion,
  IMPROVEMENT_TRIGGER_SCORE,
} from "../improvement/analyser.js";

import {
  evaluateBenchmarkDecision,
  runBenchmark,
  BENCHMARK_PROCEED_THRESHOLD,
  BENCHMARK_BLOCK_THRESHOLD,
} from "../improvement/benchmark.js";

import {
  triggerImprovement,
  activateSkillVersion,
} from "../improvement/service.js";

// ── DB helpers ────────────────────────────────────────────────────────────────

function makeImprovementDb(opts: {
  goldenItems?: object[];
  draftRow?:    { benchmarkScore: string | null; status: string } | null;
  activeRow?:   { id: string; benchmarkScore: string | null } | null;
} = {}) {
  const updateSet   = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  updateSet.mockReturnValue({ where: updateWhere });

  const returningRows = vi.fn().mockResolvedValue([{ id: "sv-new-1" }]);
  const insertValues  = vi.fn().mockReturnValue({ returning: returningRows });

  let selectCallCount = 0;
  const selectLimit = vi.fn().mockImplementation(() => {
    selectCallCount++;
    // Call 1: getActiveVersion (in triggerImprovement)
    if (selectCallCount === 1) {
      return Promise.resolve(opts.activeRow ? [opts.activeRow] : []);
    }
    // Call 2: activateSkillVersion — fetch draft to verify benchmarkScore
    return Promise.resolve(opts.draftRow ? [opts.draftRow] : []);
  });

  const selectOrderBy = vi.fn().mockReturnValue({ limit: selectLimit });
  const selectWhere = vi.fn().mockImplementation(() => ({
    limit: selectLimit,
    orderBy: selectOrderBy,
    // For goldenDatasets: no .limit() chained, returns array directly
    then: (resolve: (v: object[]) => void) => resolve(opts.goldenItems ?? []),
  }));

  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });

  const db = {
    select:  vi.fn().mockReturnValue({ from: selectFrom }),
    insert:  vi.fn().mockReturnValue({ values: insertValues }),
    update:  vi.fn().mockReturnValue({ set: updateSet }),
  } as any;

  return { db, insertValues, updateSet, updateWhere, returningRows };
}

/** Simple DB mock for runBenchmark (goldenDatasets query returns array directly) */
function makeBenchmarkDb(goldenItems: object[]) {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet   = vi.fn().mockReturnValue({ where: updateWhere });

  // select().from().where() for golden_datasets returns items directly
  const selectWhere = vi.fn().mockResolvedValue(goldenItems);
  const selectFrom  = vi.fn().mockReturnValue({ where: selectWhere });

  const db = {
    select: vi.fn().mockReturnValue({ from: selectFrom }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
  } as any;

  return { db, updateSet, updateWhere };
}

/** Simple activate DB mock */
function makeActivateDb(draftRow: { benchmarkScore: string | null; status: string } | null) {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet   = vi.fn().mockReturnValue({ where: updateWhere });

  const selectLimit = vi.fn().mockResolvedValue(draftRow ? [draftRow] : []);
  const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
  const selectFrom  = vi.fn().mockReturnValue({ where: selectWhere });

  const db = {
    select: vi.fn().mockReturnValue({ from: selectFrom }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
  } as any;

  return { db, updateSet };
}

// ── shouldTriggerImprovement ──────────────────────────────────────────────────

describe("shouldTriggerImprovement", () => {
  it("1. trust 3.4 (< 3.5) → true", () => {
    expect(shouldTriggerImprovement(3.4, null)).toBe(true);
  });

  it("2. trust 3.6, no reason → false", () => {
    expect(shouldTriggerImprovement(3.6, null)).toBe(false);
  });

  it("3. trust 4.0 + damage_control → true", () => {
    expect(shouldTriggerImprovement(4.0, "damage_control")).toBe(true);
  });

  it("4. manual trigger always fires regardless of score", () => {
    expect(shouldTriggerImprovement(5.0, "manual")).toBe(true);
  });
});

// ── evaluateBenchmarkDecision ─────────────────────────────────────────────────

describe("evaluateBenchmarkDecision", () => {
  it("5. new 4.3 vs current 4.0 (+7.5%) → proceed", () => {
    expect(evaluateBenchmarkDecision(4.3, 4.0)).toBe("proceed");
  });

  it("6. new 3.7 vs current 4.0 (-7.5%) → block", () => {
    expect(evaluateBenchmarkDecision(3.7, 4.0)).toBe("block");
  });

  it("7. new 4.1 vs current 4.0 (+2.5%) → neutral (within ±5%)", () => {
    expect(evaluateBenchmarkDecision(4.1, 4.0)).toBe("neutral");
  });

  it("8. currentScore=0, newScore>0 → proceed (first version)", () => {
    expect(evaluateBenchmarkDecision(3.5, 0)).toBe("proceed");
  });
});

// ── runBenchmark ──────────────────────────────────────────────────────────────

describe("runBenchmark", () => {
  beforeEach(() => vi.clearAllMocks());

  it("9. scores all golden items, persists score, returns decision", async () => {
    const items = [
      { input: { cv: "Jean Dupont" }, expectedOutput: { score: 4 } },
      { input: { cv: "Marie Martin" }, expectedOutput: { score: 5 } },
    ];
    const { db, updateSet } = makeBenchmarkDb(items);

    // scoreFn returns 4.5 for both items → avg 4.5 vs currentScore 4.0 → proceed
    const scoreFn = vi.fn().mockResolvedValue(4.5);

    const result = await runBenchmark(db, {
      companyId:      "company-1",
      skillType:      "qualification-cv",
      draftVersionId: "sv-1",
      currentScore:   4.0,
      scoreFn,
    });

    expect(result).not.toBeNull();
    expect(result!.newScore).toBe(4.5);
    expect(result!.itemCount).toBe(2);
    expect(result!.decision).toBe("proceed");
    expect(scoreFn).toHaveBeenCalledTimes(2);
    // Benchmark score persisted on the draft row
    expect(updateSet).toHaveBeenCalledOnce();
    const setArgs = updateSet.mock.calls[0][0];
    expect(setArgs.benchmarkScore).toBe("4.5");
    expect(setArgs.benchmarkItemCount).toBe(2);
  });

  it("10. no golden items → returns null (cannot benchmark)", async () => {
    const { db } = makeBenchmarkDb([]);
    const scoreFn = vi.fn();

    const result = await runBenchmark(db, {
      companyId:      "company-1",
      skillType:      "qualification-cv",
      draftVersionId: "sv-1",
      currentScore:   4.0,
      scoreFn,
    });

    expect(result).toBeNull();
    expect(scoreFn).not.toHaveBeenCalled();
  });
});

// ── triggerImprovement ────────────────────────────────────────────────────────

describe("triggerImprovement", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseParams = {
    companyId:      "company-1",
    agentId:        "agent-1",
    skillType:      "qualification-cv",
    newPromptBody:  "Improved prompt body...",
    newFrontmatter: { tier: 1, gdprRequired: true },
  };

  it("11. trust 3.2 → draft version created, returns id", async () => {
    const { db, returningRows } = makeImprovementDb({ activeRow: null });

    const result = await triggerImprovement(db, {
      ...baseParams,
      trustScore:    3.2,
      triggerReason: null,
    });

    expect(result.triggered).toBe(true);
    expect(result.draftVersionId).toBe("sv-new-1");
    expect(result.reason).toBe("manual"); // null → defaults to "manual"
    expect(db.insert).toHaveBeenCalledOnce();
  });

  it("12. trust 3.8, no reason → not triggered", async () => {
    const { db } = makeImprovementDb();

    const result = await triggerImprovement(db, {
      ...baseParams,
      trustScore:    3.8,
      triggerReason: null,
    });

    expect(result.triggered).toBe(false);
    expect(result.draftVersionId).toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ── activateSkillVersion ──────────────────────────────────────────────────────

describe("activateSkillVersion", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseActivate = {
    companyId:      "company-1",
    draftVersionId: "sv-draft-1",
    skillType:      "qualification-cv",
  };

  it("13. Tier A + proceed → pending_approval, NOT activated", async () => {
    const { db, updateSet } = makeActivateDb({ benchmarkScore: "4.5", status: "draft" });

    const result = await activateSkillVersion(db, {
      ...baseActivate,
      skillAutonomyTier:  "A",
      benchmarkDecision:  "proceed",
    });

    expect(result.activated).toBe(false);
    expect(result.pendingApproval).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.newStatus).toBe("pending_approval");

    // Only one update (the draft → pending_approval), NOT the deprecate step
    const statusSet = updateSet.mock.calls.find(
      (c: any[]) => c[0].status === "pending_approval",
    );
    expect(statusSet).toBeDefined();
  });

  it("14. Tier B + proceed → auto-activated (status=active)", async () => {
    const { db, updateSet } = makeActivateDb({ benchmarkScore: "4.5", status: "draft" });

    const result = await activateSkillVersion(db, {
      ...baseActivate,
      skillAutonomyTier:  "B",
      benchmarkDecision:  "proceed",
    });

    expect(result.activated).toBe(true);
    expect(result.pendingApproval).toBe(false);
    expect(result.newStatus).toBe("active");

    // Two update calls: deprecate old active + activate new
    expect(db.update).toHaveBeenCalledTimes(2);
    const activeSet = updateSet.mock.calls.find(
      (c: any[]) => c[0].status === "active",
    );
    expect(activeSet).toBeDefined();
  });

  it("15. block decision → blocked regardless of tier", async () => {
    const { db, updateSet } = makeActivateDb({ benchmarkScore: "3.5", status: "draft" });

    const result = await activateSkillVersion(db, {
      ...baseActivate,
      skillAutonomyTier:  "A",
      benchmarkDecision:  "block",
    });

    expect(result.blocked).toBe(true);
    expect(result.activated).toBe(false);
    expect(result.newStatus).toBe("blocked");

    const blockedSet = updateSet.mock.calls.find(
      (c: any[]) => c[0].status === "blocked",
    );
    expect(blockedSet).toBeDefined();
  });

  it("16. throws if benchmark not yet run (benchmarkScore=null)", async () => {
    const { db } = makeActivateDb({ benchmarkScore: null, status: "draft" });

    await expect(
      activateSkillVersion(db, {
        ...baseActivate,
        skillAutonomyTier:  "B",
        benchmarkDecision:  "proceed",
      }),
    ).rejects.toThrow(/before benchmark ran/);
  });
});

// ── bumpMinorVersion ──────────────────────────────────────────────────────────

describe("bumpMinorVersion", () => {
  it("17. bumps minor version correctly", () => {
    expect(bumpMinorVersion("1.0.0")).toBe("1.1.0");
    expect(bumpMinorVersion("1.9.0")).toBe("1.10.0");
    expect(bumpMinorVersion("2.3.0")).toBe("2.4.0");
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("IMPROVEMENT_TRIGGER_SCORE is 3.5", () => {
    expect(IMPROVEMENT_TRIGGER_SCORE).toBe(3.5);
  });

  it("BENCHMARK thresholds are 5%", () => {
    expect(BENCHMARK_PROCEED_THRESHOLD).toBe(0.05);
    expect(BENCHMARK_BLOCK_THRESHOLD).toBe(0.05);
  });
});
