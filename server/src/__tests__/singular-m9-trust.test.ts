/**
 * M9 — Trust calibration system
 *
 * Tests:
 *  1.  calculateTrustScore: correct weighted formula (all mid values)
 *  2.  calculateTrustScore: all zeros → 0
 *  3.  calculateTrustScore: max values (5★, 100% pass rates) → 5.0
 *  4.  calculateTrustScore: result clamped to [0, 5]
 *  5.  getAutonomyLevel: score 1.5 → "building"
 *  6.  getAutonomyLevel: score 3.5 → "supervised"
 *  7.  getAutonomyLevel: score 4.2 → "trusted"
 *  8.  getAutonomyLevel: score 4.8 → "highlyTrusted"
 *  9.  recordApproval: 4★ increments streak; score + level upserted
 * 10.  recordApproval: 3★ resets streak to 0
 * 11.  recordApproval: streak hits 10, Tier A → proposal created, NOT auto-activated
 * 12.  recordApproval: streak hits 10, Tier B → auto-activated, no proposal row
 * 13.  recordApproval: Tier A streak 9 → no proposal yet
 * 14.  checkTrustDowngrade: score drops from "trusted" to "supervised" → downgraded=true
 * 15.  checkTrustDowngrade: score stays within "supervised" → downgraded=false
 * 16.  STREAK_THRESHOLD is 10 per spec
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  calculateTrustScore,
  getAutonomyLevel,
  TRUST_WEIGHTS,
  AUTONOMY_THRESHOLDS,
} from "../trust/calculator.js";

import {
  recordApproval,
  checkTrustDowngrade,
  STREAK_THRESHOLD,
} from "../trust/service.js";

// ── DB helpers ────────────────────────────────────────────────────────────────

function makeTrustDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const set = vi.fn().mockResolvedValue(undefined);
  const where = vi.fn().mockReturnValue({ set: vi.fn().mockResolvedValue(undefined) });
  const update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where }) });

  const db = {
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    update,
  } as any;

  return { db, insertValues, onConflictDoUpdate };
}

function baseApprovalParams(overrides: object = {}) {
  return {
    companyId:         "company-1",
    agentId:           "agent-1",
    skillType:         "qualification-cv",
    skillAutonomyTier: "A" as "A" | "B",
    rating:            4,
    gatePassed:        true,
    schemaPassed:      true,
    qualityRatingAvg:  4.0,
    gatePassRate:      0.9,
    schemaPassRate:    0.95,
    taskCountWindow:   15,
    currentStreak:     0,
    currentLevel:      "building" as const,
    ...overrides,
  };
}

// ── calculateTrustScore ───────────────────────────────────────────────────────

describe("calculateTrustScore", () => {
  it("1. correct weighted formula", () => {
    // qualityRatingAvg=3 → 3×0.50=1.5
    // gatePassRate=0.8   → 0.8×5×0.30=1.2
    // schemaPassRate=0.7 → 0.7×5×0.20=0.7
    // total = 3.4
    const score = calculateTrustScore({
      qualityRatingAvg: 3,
      gatePassRate:     0.8,
      schemaPassRate:   0.7,
    });
    expect(score).toBeCloseTo(3.4, 1);
  });

  it("2. all zeros → 0", () => {
    const score = calculateTrustScore({
      qualityRatingAvg: 0,
      gatePassRate:     0,
      schemaPassRate:   0,
    });
    expect(score).toBe(0);
  });

  it("3. max values → 5.0", () => {
    const score = calculateTrustScore({
      qualityRatingAvg: 5,
      gatePassRate:     1,
      schemaPassRate:   1,
    });
    expect(score).toBe(5);
  });

  it("4. clamped to [0, 5] even with out-of-range inputs", () => {
    const score = calculateTrustScore({
      qualityRatingAvg: 10,
      gatePassRate:     2,
      schemaPassRate:   3,
    });
    expect(score).toBe(5);
  });
});

// ── getAutonomyLevel ──────────────────────────────────────────────────────────

describe("getAutonomyLevel", () => {
  it("5. score 1.5 → building", () => {
    expect(getAutonomyLevel(1.5)).toBe("building");
  });

  it("6. score 3.5 → supervised", () => {
    expect(getAutonomyLevel(3.5)).toBe("supervised");
  });

  it("7. score 4.2 → trusted", () => {
    expect(getAutonomyLevel(4.2)).toBe("trusted");
  });

  it("8. score 4.8 → highlyTrusted", () => {
    expect(getAutonomyLevel(4.8)).toBe("highlyTrusted");
  });
});

// ── recordApproval ────────────────────────────────────────────────────────────

describe("recordApproval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("9. 4★ increments streak and upserts score + level", async () => {
    const { db, onConflictDoUpdate } = makeTrustDb();

    const result = await recordApproval(db, baseApprovalParams({
      rating:        4,
      currentStreak: 3,
    }));

    expect(result.newStreak).toBe(4);
    expect(result.newScore).toBeGreaterThan(0);
    expect(result.proposalCreated).toBe(false);
    expect(result.autoActivated).toBe(false);
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
  });

  it("10. 3★ resets streak to 0", async () => {
    const { db } = makeTrustDb();

    const result = await recordApproval(db, baseApprovalParams({
      rating:        3,
      currentStreak: 7,
    }));

    expect(result.newStreak).toBe(0);
  });

  it("11. Tier A: streak reaches 10 → proposal created, level NOT changed", async () => {
    const { db, insertValues } = makeTrustDb();

    const result = await recordApproval(db, baseApprovalParams({
      skillAutonomyTier: "A",
      rating:            5,
      currentStreak:     9, // this approval makes it 10
      currentLevel:      "building",
    }));

    expect(result.newStreak).toBe(10);
    expect(result.proposalCreated).toBe(true);
    expect(result.autoActivated).toBe(false);
    // level stays at "building" until human approves
    expect(result.newLevel).toBe("building");

    // Two inserts: trust_proposals + trust_scores upsert
    expect(db.insert).toHaveBeenCalledTimes(2);
    const proposalValues = insertValues.mock.calls[0][0];
    expect(proposalValues.currentLevel).toBe("building");
    expect(proposalValues.proposedLevel).toBe("supervised");
    expect(proposalValues.status).toBe("pending");
    expect(proposalValues.approvalStreak).toBe(10);
  });

  it("12. Tier B: streak reaches 10 → auto-activated, no proposal row", async () => {
    const { db } = makeTrustDb();

    const result = await recordApproval(db, baseApprovalParams({
      skillAutonomyTier: "B",
      rating:            5,
      currentStreak:     9,
      currentLevel:      "supervised",
      qualityRatingAvg:  4.5,
      gatePassRate:      1.0,
      schemaPassRate:    1.0,
    }));

    expect(result.autoActivated).toBe(true);
    expect(result.proposalCreated).toBe(false);
    expect(result.newLevel).toBe("trusted"); // next level up from supervised

    // Only one insert (trust_scores upsert) — no trust_proposals insert
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it("13. Tier A, streak = 9 → no proposal yet", async () => {
    const { db } = makeTrustDb();

    const result = await recordApproval(db, baseApprovalParams({
      skillAutonomyTier: "A",
      rating:            5,
      currentStreak:     8, // makes streak 9, not yet 10
      currentLevel:      "building",
    }));

    expect(result.newStreak).toBe(9);
    expect(result.proposalCreated).toBe(false);
    // Only trust_scores upsert, no trust_proposals
    expect(db.insert).toHaveBeenCalledTimes(1);
  });
});

// ── checkTrustDowngrade ───────────────────────────────────────────────────────

describe("checkTrustDowngrade", () => {
  beforeEach(() => vi.clearAllMocks());

  it("14. score drops from trusted (4.2) to supervised range (3.5) → downgraded", async () => {
    const setMock  = vi.fn().mockResolvedValue(undefined);
    const whereMock = vi.fn().mockResolvedValue(undefined);
    setMock.mockReturnValue({ where: whereMock });
    const db = { update: vi.fn().mockReturnValue({ set: setMock }) } as any;

    const result = await checkTrustDowngrade(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      skillType:    "qualification-cv",
      currentLevel: "trusted",
      newScore:     3.5,
    });

    expect(result.downgraded).toBe(true);
    expect(result.newLevel).toBe("supervised");
    expect(db.update).toHaveBeenCalledOnce();
  });

  it("15. score stays within supervised range → downgraded=false, no DB update", async () => {
    const db = { update: vi.fn() } as any;

    const result = await checkTrustDowngrade(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      skillType:    "qualification-cv",
      currentLevel: "supervised",
      newScore:     3.2,
    });

    expect(result.downgraded).toBe(false);
    expect(result.newLevel).toBe("supervised");
    expect(db.update).not.toHaveBeenCalled();
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("16. STREAK_THRESHOLD is 10", () => {
    expect(STREAK_THRESHOLD).toBe(10);
  });

  it("TRUST_WEIGHTS sum to 1.0", () => {
    const sum = TRUST_WEIGHTS.qualityRating + TRUST_WEIGHTS.gatePassRate + TRUST_WEIGHTS.schemaPassRate;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("AUTONOMY_THRESHOLDS cover 0–5 without gaps", () => {
    expect(AUTONOMY_THRESHOLDS.building.min).toBe(0);
    expect(AUTONOMY_THRESHOLDS.highlyTrusted.max).toBe(5.0);
    expect(AUTONOMY_THRESHOLDS.building.max).toBeLessThan(AUTONOMY_THRESHOLDS.supervised.min);
    expect(AUTONOMY_THRESHOLDS.supervised.max).toBeLessThan(AUTONOMY_THRESHOLDS.trusted.min);
  });
});
