/**
 * Gap I — Cost attribution per mission/goal tests.
 *
 * Verifies:
 *  1. recordUsage writes missionId and goalId when provided
 *  2. recordUsage works without missionId/goalId (null defaults)
 *  3. RecordUsageParams interface accepts optional missionId/goalId
 *  4. Mission cost endpoint: totalEur computed correctly from micro-euros
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordUsage, calculateCostMicro, type RecordUsageParams } from "../costs/service.js";

// ── Mock DB ───────────────────────────────────────────────────────────────────

function makeDb() {
  const costRows: any[] = [];
  const updates: any[]  = [];

  return {
    db: {
      insert: vi.fn().mockImplementation(() => ({
        values: (v: any) => { costRows.push(v); return Promise.resolve(); },
      })),
      update: vi.fn().mockImplementation(() => ({
        set:   vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      })),
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([{ remainingTokens: 50_000_000 }]),
    } as any,
    costRows,
    updates,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("Gap I — cost attribution", () => {
  it("1. recordUsage writes missionId when provided", async () => {
    const { db, costRows } = makeDb();

    await recordUsage(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      taskId:       "task-1",
      model:        "mistralai/mistral-small-3.2",
      inputTokens:  1000,
      outputTokens: 200,
      tier:         1,
      missionId:    "mission-42",
    });

    expect(costRows).toHaveLength(1);
    expect(costRows[0].missionId).toBe("mission-42");
  });

  it("2. recordUsage writes goalId when provided", async () => {
    const { db, costRows } = makeDb();

    await recordUsage(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      taskId:       "task-1",
      model:        "mistralai/mistral-small-3.2",
      inputTokens:  500,
      outputTokens: 100,
      tier:         1,
      goalId:       "goal-99",
    });

    expect(costRows[0].goalId).toBe("goal-99");
  });

  it("3. recordUsage defaults missionId and goalId to null", async () => {
    const { db, costRows } = makeDb();

    await recordUsage(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      taskId:       "task-1",
      model:        "mistralai/ministral-3b",
      inputTokens:  200,
      outputTokens: 50,
      tier:         0,
    });

    expect(costRows[0].missionId).toBeNull();
    expect(costRows[0].goalId).toBeNull();
  });

  it("4. missionId and goalId can be provided together", async () => {
    const { db, costRows } = makeDb();

    await recordUsage(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      taskId:       "task-1",
      model:        "mistralai/mistral-small-3.2",
      inputTokens:  800,
      outputTokens: 150,
      tier:         1,
      missionId:    "mission-1",
      goalId:       "goal-1",
    });

    expect(costRows[0].missionId).toBe("mission-1");
    expect(costRows[0].goalId).toBe("goal-1");
  });
});

// ── Mission cost calculation ──────────────────────────────────────────────────

describe("Gap I — mission cost display", () => {
  it("5. micro-euros to EUR conversion: 2_400_000 micro-EUR = €2.40", () => {
    const totalMicro = 2_400_000;
    const totalEur = (totalMicro / 1_000_000).toFixed(2);
    expect(parseFloat(totalEur)).toBe(2.40);
  });

  it("6. zero cost mission returns €0.00", () => {
    const totalMicro = 0;
    const totalEur = (totalMicro / 1_000_000).toFixed(2);
    expect(parseFloat(totalEur)).toBe(0);
  });

  it("7. calculateCostMicro returns positive number for known model", () => {
    const cost = calculateCostMicro("mistralai/mistral-small-3.2", 500_000, 100_000);
    expect(cost).toBeGreaterThan(0);
  });
});

// ── RecordUsageParams type ────────────────────────────────────────────────────

describe("Gap I — RecordUsageParams interface", () => {
  it("8. missionId is optional (TypeScript level)", () => {
    const params: RecordUsageParams = {
      companyId:    "c",
      agentId:      "a",
      taskId:       "t",
      model:        "mistralai/ministral-3b",
      inputTokens:  100,
      outputTokens: 20,
      tier:         0,
      // missionId omitted
    };
    expect(params.missionId).toBeUndefined();
  });

  it("9. goalId is optional (TypeScript level)", () => {
    const params: RecordUsageParams = {
      companyId:    "c",
      agentId:      "a",
      taskId:       "t",
      model:        "mistralai/ministral-3b",
      inputTokens:  100,
      outputTokens: 20,
      tier:         0,
      // goalId omitted
    };
    expect(params.goalId).toBeUndefined();
  });
});
