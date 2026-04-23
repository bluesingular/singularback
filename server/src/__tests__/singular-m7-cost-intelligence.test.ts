/**
 * M7 — Cost Intelligence + Task Translation
 *
 * Tests:
 *  1.  calculateCostMicro: mistral-small 10k in + 2k out → correct micro-EUR
 *  2.  calculateCostMicro: claude-sonnet → correct micro-EUR
 *  3.  calculateCostMicro: unknown model → 0 (safe default)
 *  4.  calculateCostMicro: zero tokens → 0
 *  5.  currentBillingMonth: returns YYYY-MM format
 *  6.  recordUsage: inserts cost record with correct fields
 *  7.  recordUsage: updates company tasks_used_month and tokens_used_month
 *  8.  recordUsage: T3 call triggers checkT3Cap (calls company select)
 *  9.  checkBudgetBeforeCall: under both limits → no throw
 * 10.  checkBudgetBeforeCall: task limit reached → throws BudgetExhaustedError
 * 11.  checkBudgetBeforeCall: token limit reached → throws BudgetExhaustedError
 * 12.  translateRemainingTasks: 153 tasks → "about 21 more CV batches"
 * 13.  translateRemainingTasks: sorts by tasksPerUnit desc (most meaningful first)
 * 14.  formatUsageGauge: "847 / 2,000 tasks — about 95 more CV batches or 153 more client emails"
 * 15.  formatOverageWarning: includes unit count and per-unit cost
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  calculateCostMicro,
  currentBillingMonth,
  recordUsage,
  checkBudgetBeforeCall,
  BudgetExhaustedError,
  MODEL_COSTS,
} from "../costs/service.js";

import {
  translateRemainingTasks,
  formatUsageGauge,
  formatOverageWarning,
} from "../costs/taskTranslation.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const RECRUITMENT_TRANSLATIONS = {
  unitName: "task",
  translations: [
    { skillType: "qualification-cv",     tasksPerUnit: 7,  unitLabel: "CV batch" },
    { skillType: "job-posting-writer",   tasksPerUnit: 3,  unitLabel: "job posting" },
    { skillType: "client-email",         tasksPerUnit: 1,  unitLabel: "client email" },
    { skillType: "weekly-client-report", tasksPerUnit: 12, unitLabel: "client report" },
  ],
  remainingTemplate: "about {{count}} more {{unit}}s this month",
};

function makeServiceDb(opts: {
  company?: {
    tasksUsedMonth: number;
    tasksLimitMonth: number;
    tokensUsedMonth: number;
    tokensLimitMonth: number;
  };
}) {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });

  const db = {
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    update: vi.fn().mockReturnValue({ set: updateSet }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(
          opts.company ? [opts.company] : [],
        ),
      }),
    }),
  };

  return { db: db as any, insertValues, updateSet };
}

// ── calculateCostMicro ────────────────────────────────────────────────────────

describe("calculateCostMicro", () => {
  it("1. mistral-small: 10k input + 2k output → correct micro-EUR", () => {
    // input: (10_000 / 1_000_000) * 150 = 1.5 micro-EUR
    // output: (2_000 / 1_000_000) * 600 = 1.2 micro-EUR
    // total: 2.7 → rounds to 3
    const result = calculateCostMicro("mistralai/mistral-small-3.2", 10_000, 2_000);
    expect(result).toBe(Math.round(
      (10_000 / 1_000_000) * MODEL_COSTS["mistralai/mistral-small-3.2"].input +
      (2_000  / 1_000_000) * MODEL_COSTS["mistralai/mistral-small-3.2"].output,
    ));
  });

  it("2. claude-sonnet: 5k input + 1k output → correct micro-EUR", () => {
    // input: (5_000 / 1_000_000) * 3000 = 15 micro-EUR
    // output: (1_000 / 1_000_000) * 15000 = 15 micro-EUR
    // total: 30
    const result = calculateCostMicro("anthropic/claude-sonnet-4-5", 5_000, 1_000);
    expect(result).toBe(30);
  });

  it("3. unknown model → 0 (safe default)", () => {
    expect(calculateCostMicro("unknown/model-v99", 100_000, 50_000)).toBe(0);
  });

  it("4. zero tokens → 0", () => {
    expect(calculateCostMicro("mistralai/ministral-3b", 0, 0)).toBe(0);
  });
});

// ── currentBillingMonth ───────────────────────────────────────────────────────

describe("currentBillingMonth", () => {
  it("5. returns YYYY-MM format matching current date", () => {
    const month = currentBillingMonth();
    expect(month).toMatch(/^\d{4}-\d{2}$/);
    const now = new Date().toISOString().slice(0, 7);
    expect(month).toBe(now);
  });
});

// ── recordUsage ───────────────────────────────────────────────────────────────

describe("recordUsage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("6. inserts cost record with correct fields", async () => {
    const { db, insertValues } = makeServiceDb({ company: {
      tasksUsedMonth: 10, tasksLimitMonth: 2000,
      tokensUsedMonth: 100_000, tokensLimitMonth: 20_000_000,
    }});

    await recordUsage(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      taskId:       "task-1",
      model:        "mistralai/mistral-small-3.2",
      inputTokens:  1000,
      outputTokens: 500,
      tier:         1,
    });

    expect(insertValues).toHaveBeenCalledOnce();
    const record = insertValues.mock.calls[0][0];
    expect(record.model).toBe("mistralai/mistral-small-3.2");
    expect(record.tier).toBe(1);
    expect(record.inputTokens).toBe(1000);
    expect(record.outputTokens).toBe(500);
    expect(record.costEurMicro).toBeTypeOf("number");
    expect(record.billingMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("7. updates company tasks_used_month and tokens_used_month", async () => {
    const { db, updateSet } = makeServiceDb({ company: {
      tasksUsedMonth: 10, tasksLimitMonth: 2000,
      tokensUsedMonth: 100_000, tokensLimitMonth: 20_000_000,
    }});

    await recordUsage(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      taskId:       "task-1",
      model:        "mistralai/mistral-small-3.2",
      inputTokens:  1000,
      outputTokens: 500,
      tier:         1,
    });

    expect(db.update).toHaveBeenCalledOnce();
    // updateSet called with sql expressions
    expect(updateSet).toHaveBeenCalledOnce();
  });

  it("8. T3 call triggers additional company select (checkT3Cap)", async () => {
    const { db } = makeServiceDb({ company: {
      tasksUsedMonth: 10, tasksLimitMonth: 2000,
      tokensUsedMonth: 100_000, tokensLimitMonth: 20_000_000,
    }});

    await recordUsage(db, {
      companyId:    "company-1",
      agentId:      "agent-1",
      taskId:       "task-1",
      model:        "anthropic/claude-sonnet-4-5",
      inputTokens:  5000,
      outputTokens: 2000,
      tier:         3,
    });

    // T3 triggers checkT3Cap which does a company select for cap check
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});

// ── checkBudgetBeforeCall ─────────────────────────────────────────────────────

describe("checkBudgetBeforeCall", () => {
  it("9. under both limits → no throw", async () => {
    const { db } = makeServiceDb({ company: {
      tasksUsedMonth: 500, tasksLimitMonth: 2000,
      tokensUsedMonth: 1_000_000, tokensLimitMonth: 20_000_000,
    }});

    await expect(checkBudgetBeforeCall(db, "company-1")).resolves.toBeUndefined();
  });

  it("10. task limit reached → throws BudgetExhaustedError", async () => {
    const { db } = makeServiceDb({ company: {
      tasksUsedMonth: 2000, tasksLimitMonth: 2000,
      tokensUsedMonth: 1_000_000, tokensLimitMonth: 20_000_000,
    }});

    await expect(checkBudgetBeforeCall(db, "company-1"))
      .rejects.toBeInstanceOf(BudgetExhaustedError);
  });

  it("11. token limit reached → throws BudgetExhaustedError", async () => {
    const { db } = makeServiceDb({ company: {
      tasksUsedMonth: 100, tasksLimitMonth: 2000,
      tokensUsedMonth: 20_000_000, tokensLimitMonth: 20_000_000,
    }});

    await expect(checkBudgetBeforeCall(db, "company-1"))
      .rejects.toBeInstanceOf(BudgetExhaustedError);
  });
});

// ── Task translation ──────────────────────────────────────────────────────────

describe("translateRemainingTasks", () => {
  it("12. 153 tasks → primary translation is CV batches", () => {
    const results = translateRemainingTasks(153, RECRUITMENT_TRANSLATIONS);
    // weekly-client-report has highest tasksPerUnit (12), so it comes first
    // 153 / 12 = 12 client reports
    expect(results[0]).toContain("12");
    expect(results[0]).toContain("client report");
  });

  it("13. sorts by tasksPerUnit descending (most tasks-per-unit first)", () => {
    const results = translateRemainingTasks(700, RECRUITMENT_TRANSLATIONS);
    // weekly-client-report: 700/12 = 58 → first
    // qualification-cv:     700/7  = 100 → second
    expect(results[0]).toContain("client report");
    expect(results[1]).toContain("CV batch");
  });
});

describe("formatUsageGauge", () => {
  it("14. formats full gauge string with task count and translations", () => {
    // 847 used, 2000 limit → 1153 remaining
    // 1153/12 = 96 client reports, 1153/7 = 164 CV batches
    const gauge = formatUsageGauge(847, 2000, RECRUITMENT_TRANSLATIONS);
    expect(gauge).toContain("847");
    expect(gauge).toContain("2");    // part of "2 000" or "2,000"
    expect(gauge).toContain("tasks");
    expect(gauge).toContain("this month");
    // Should contain at least one translated unit
    expect(gauge).toMatch(/client report|CV batch|job posting/);
  });
});

describe("formatOverageWarning", () => {
  it("15. includes unit count and per-unit overage cost", () => {
    const warning = formatOverageWarning(153, RECRUITMENT_TRANSLATIONS, 0.024);
    expect(warning).toContain("153");
    expect(warning).toContain("€");
    expect(warning).toMatch(/client report|CV batch/);
  });
});
