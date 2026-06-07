/**
 * Tests for AG-3, AG-4, AG-8, Gap C, Gap E, Gap N
 *
 * AG-3  — Task checkpointing + resume (tasks/checkpoints.ts)
 * AG-4  — Multi-factor confidence scoring (safety/confidence.ts)
 * AG-8  — Hybrid reasoning: rule-based steps (tasks/rule-engine.ts)
 * Gap C — Trust bootstrapping protocol (trust/bootstrap.ts)
 * Gap E — Zero-tolerance action classes (safety/zero-tolerance.ts)
 * Gap N — SLA tiers (billing/sla.ts)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// AG-3 — Task checkpointing
// ─────────────────────────────────────────────────────────────────────────────

import {
  writeCheckpoint,
  loadLatestCheckpoint,
  clearCheckpoints,
  resumeOrStart,
  type CheckpointContext,
} from "../tasks/checkpoints.js";

vi.mock("@paperclipai/db", async () => {
  const TASK_ID    = "ta000000-0000-4000-8000-000000000001";
  const COMPANY_ID = "ca000000-0000-4000-8000-000000000001";

  const checkpointRows: Record<string, unknown>[] = [];

  return {
    taskCheckpoints: { id: "taskCheckpoints" },
    issues:          { id: "issues", cancelRequested: "cancelRequested", companyId: "companyId" },
    eq:      (a: unknown, b: unknown) => ({ __eq: [a, b] }),
    and:     (...args: unknown[])    => ({ __and: args }),
    desc:    (a: unknown)            => ({ __desc: a }),
    gt:      (a: unknown, b: unknown) => ({ __gt: [a, b] }),
    gte:     (a: unknown, b: unknown) => ({ __gte: [a, b] }),
    subHours: (d: Date, h: number)   => new Date(d.getTime() - h * 3600000),
  };
});

function makeCheckpointDb(rows: CheckpointContext[] = []) {
  const stored: CheckpointContext[] = [...rows];

  const buildSelect = () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => Promise.resolve(
            stored.length > 0
              ? [stored.reduce((best, r) => r.stepNumber > best.stepNumber ? r : best, stored[0]!)]
              : [],
          ),
        }),
      }),
    }),
  });

  return {
    stored,
    insert: () => ({
      values: (v: CheckpointContext) => {
        stored.push(v);
        return Promise.resolve();
      },
    }),
    select: buildSelect,
    delete: () => ({
      where: () => {
        stored.splice(0, stored.length);
        return Promise.resolve();
      },
    }),
  } as unknown as import("@paperclipai/db").Db;
}

describe("AG-3 — Task checkpointing", () => {
  const TASK_ID    = "ta000000-0000-4000-8000-000000000001";
  const COMPANY_ID = "ca000000-0000-4000-8000-000000000001";

  it("writeCheckpoint stores step data", async () => {
    const db = makeCheckpointDb();
    await writeCheckpoint(db, TASK_ID, COMPANY_ID, {
      stepNumber:     1,
      stepName:       "context_assembly",
      executionState: { model: "mistral-small-3.2" },
    });
    expect((db as any).stored).toHaveLength(1);
    expect((db as any).stored[0].stepNumber).toBe(1);
  });

  it("loadLatestCheckpoint returns null when no checkpoints exist", async () => {
    const db = makeCheckpointDb([]);
    const result = await loadLatestCheckpoint(db, TASK_ID, COMPANY_ID);
    expect(result).toBeNull();
  });

  it("loadLatestCheckpoint returns highest stepNumber", async () => {
    const db = makeCheckpointDb([
      { stepNumber: 1, stepName: "step1", executionState: {} },
      { stepNumber: 5, stepName: "step5", executionState: { done: true } },
      { stepNumber: 3, stepName: "step3", executionState: {} },
    ]);
    const result = await loadLatestCheckpoint(db, TASK_ID, COMPANY_ID);
    expect(result?.stepNumber).toBe(5);
    expect(result?.stepName).toBe("step5");
  });

  it("clearCheckpoints empties stored rows", async () => {
    const db = makeCheckpointDb([
      { stepNumber: 1, stepName: "step1", executionState: {} },
    ]);
    await clearCheckpoints(db, TASK_ID, COMPANY_ID);
    expect((db as any).stored).toHaveLength(0);
  });

  it("resumeOrStart returns null for fresh task", async () => {
    const db = makeCheckpointDb([]);
    const ctx = await resumeOrStart(db, TASK_ID, COMPANY_ID);
    expect(ctx).toBeNull();
  });

  it("resumeOrStart returns checkpoint context when one exists", async () => {
    const db = makeCheckpointDb([
      { stepNumber: 7, stepName: "post_output", executionState: { recycleCount: 1 } },
    ]);
    const ctx = await resumeOrStart(db, TASK_ID, COMPANY_ID, "trace-123");
    expect(ctx?.stepNumber).toBe(7);
    expect(ctx?.executionState).toMatchObject({ recycleCount: 1 });
  });

  it("checkpoints are transient — writeCheckpoint + clearCheckpoints leaves empty", async () => {
    const db = makeCheckpointDb();
    await writeCheckpoint(db, TASK_ID, COMPANY_ID, { stepNumber: 1, stepName: "s1", executionState: {} });
    await writeCheckpoint(db, TASK_ID, COMPANY_ID, { stepNumber: 2, stepName: "s2", executionState: {} });
    await clearCheckpoints(db, TASK_ID, COMPANY_ID);
    expect((db as any).stored).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-4 — Confidence scoring
// ─────────────────────────────────────────────────────────────────────────────

import {
  runConfidenceScoring,
  shouldForceApproval,
  type ConfidenceScore,
} from "../safety/confidence.js";
import * as openrouter from "../llm/openrouter.js";

describe("AG-4 — Multi-factor confidence scoring", () => {
  const BASE_PARAMS = {
    companyId: "cb000000-0000-4000-8000-000000000002",
    taskId:    "tb000000-0000-4000-8000-000000000002",
    agentId:   "ab000000-0000-4000-8000-000000000002",
    taskBrief: "Qualify this CV for a React developer role",
    output:    "Score: 8/10. The candidate meets 4 of 5 criteria.",
  };

  it("returns high confidence when LLM returns strong scores", async () => {
    vi.spyOn(openrouter, "callLLM").mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        reasoning_quality: 0.9,
        evidence_strength: 0.85,
        output_consistency: 0.8,
        input_familiarity: 0.75,
      }) } }],
    } as any);

    const score = await runConfidenceScoring(BASE_PARAMS);
    expect(score.flag).toBe("high");
    expect(score.overall).toBeGreaterThanOrEqual(0.70);
  });

  it("returns low confidence when LLM returns weak scores", async () => {
    vi.spyOn(openrouter, "callLLM").mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        reasoning_quality: 0.3,
        evidence_strength: 0.2,
        output_consistency: 0.25,
        input_familiarity: 0.15,
      }) } }],
    } as any);

    const score = await runConfidenceScoring(BASE_PARAMS);
    expect(score.flag).toBe("low");
    expect(score.overall).toBeLessThan(0.50);
  });

  it("returns medium fallback when LLM fails", async () => {
    vi.spyOn(openrouter, "callLLM").mockRejectedValueOnce(new Error("network error"));

    const score = await runConfidenceScoring(BASE_PARAMS);
    expect(score.flag).toBe("medium");
    expect(score.overall).toBe(0.6);
  });

  it("shouldForceApproval returns true when overall < 0.50", () => {
    const low: ConfidenceScore = {
      taskId: "t1", reasoningQuality: 0.3, evidenceStrength: 0.2,
      outputConsistency: 0.25, inputFamiliarity: 0.15, overall: 0.24, flag: "low",
    };
    expect(shouldForceApproval(low)).toBe(true);
  });

  it("shouldForceApproval returns false when overall >= 0.50", () => {
    const medium: ConfidenceScore = {
      taskId: "t2", reasoningQuality: 0.6, evidenceStrength: 0.6,
      outputConsistency: 0.6, inputFamiliarity: 0.6, overall: 0.60, flag: "medium",
    };
    expect(shouldForceApproval(medium)).toBe(false);
  });

  it("weights sum to 1.0 (0.30 + 0.30 + 0.20 + 0.20)", () => {
    const weights = [0.30, 0.30, 0.20, 0.20];
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(1.0);
  });

  it("all dimension scores are clamped to 0-1", async () => {
    vi.spyOn(openrouter, "callLLM").mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        reasoning_quality: 1.5,    // over 1
        evidence_strength: -0.5,   // below 0
        output_consistency: 0.7,
        input_familiarity: 0.8,
      }) } }],
    } as any);

    const score = await runConfidenceScoring(BASE_PARAMS);
    expect(score.reasoningQuality).toBeLessThanOrEqual(1.0);
    expect(score.evidenceStrength).toBeGreaterThanOrEqual(0.0);
  });

  it("uses T1_FR model (Mistral EU) — GDPR invariant", async () => {
    const spy = vi.spyOn(openrouter, "callLLM").mockResolvedValueOnce({
      choices: [{ message: { content: "{}" } }],
    } as any);

    await runConfidenceScoring(BASE_PARAMS);
    expect(spy.mock.calls[0]![0].model).toBe("mistralai/mistral-small-3.2");
    expect(spy.mock.calls[0]![0].gdprRequired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-8 — Rule-based steps
// ─────────────────────────────────────────────────────────────────────────────

import {
  executeRules,
  parseRuleSet,
  type RuleSet,
  type RuleEngineResult,
} from "../tasks/rule-engine.js";

describe("AG-8 — Hybrid reasoning: rule-based steps", () => {
  const ELIGIBILITY_RULES: RuleSet = {
    defaultOutcome: "fail",
    rules: [
      { id: "r1", field: "score", op: "gte", value: 7, outcome: "pass" },
      { id: "r2", field: "score", op: "lt",  value: 3, outcome: "fail" },
    ],
  };

  it("first matching rule wins (short-circuit)", () => {
    const result = executeRules(ELIGIBILITY_RULES, { score: 8 }, "eligibility_check");
    expect(result.overall).toBe("pass");
    expect(result.results.find(r => r.ruleId === "r1")?.matched).toBe(true);
  });

  it("uses defaultOutcome when no rule matches", () => {
    const result = executeRules(ELIGIBILITY_RULES, { score: 5 }, "eligibility_check");
    expect(result.overall).toBe("fail");
  });

  it("all operators work correctly", () => {
    const rs: RuleSet = {
      defaultOutcome: "fail",
      rules: [
        { id: "eq",  field: "status", op: "eq",  value: "active",  outcome: "pass" },
        { id: "neq", field: "status", op: "neq", value: "banned",  outcome: "pass" },
        { id: "gt",  field: "n",      op: "gt",  value: 5,         outcome: "pass" },
        { id: "lt",  field: "n",      op: "lt",  value: 5,         outcome: "pass" },
        { id: "gte", field: "n",      op: "gte", value: 5,         outcome: "pass" },
        { id: "lte", field: "n",      op: "lte", value: 5,         outcome: "pass" },
        { id: "contains", field: "text", op: "contains", value: "hello", outcome: "pass" },
        { id: "exists",   field: "key",  op: "exists",            outcome: "pass" },
      ],
    };

    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[0]!] }, { status: "active" }, "s").overall).toBe("pass");
    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[1]!] }, { status: "ok" }, "s").overall).toBe("pass");
    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[2]!] }, { n: 6 }, "s").overall).toBe("pass");
    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[3]!] }, { n: 4 }, "s").overall).toBe("pass");
    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[4]!] }, { n: 5 }, "s").overall).toBe("pass");
    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[5]!] }, { n: 5 }, "s").overall).toBe("pass");
    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[6]!] }, { text: "say hello world" }, "s").overall).toBe("pass");
    expect(executeRules({ defaultOutcome: "fail", rules: [rs.rules[7]!] }, { key: "value" }, "s").overall).toBe("pass");
  });

  it("dot-notation field access works on nested objects", () => {
    const rs: RuleSet = {
      defaultOutcome: "fail",
      rules: [{ id: "nested", field: "candidate.score", op: "gte", value: 7, outcome: "pass" }],
    };
    const result = executeRules(rs, { candidate: { score: 9 } }, "nested_check");
    expect(result.overall).toBe("pass");
  });

  it("escalate outcome is returned correctly", () => {
    const rs: RuleSet = {
      defaultOutcome: "fail",
      rules: [{ id: "edge", field: "score", op: "gte", value: 4.5, outcome: "escalate" }],
    };
    expect(executeRules(rs, { score: 5.0 }, "s").overall).toBe("escalate");
  });

  it("executes in < 10ms (deterministic, not an LLM call)", () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      executeRules(ELIGIBILITY_RULES, { score: i % 10 }, "bench");
    }
    expect(Date.now() - start).toBeLessThan(100); // 100 runs in < 100ms
  });

  it("result includes durationMs", () => {
    const result = executeRules(ELIGIBILITY_RULES, { score: 5 }, "s");
    expect(typeof result.durationMs).toBe("number");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  describe("parseRuleSet", () => {
    it("parses valid JSON", () => {
      const json = JSON.stringify({
        rules: [{ id: "r1", field: "score", op: "gte", value: 7, outcome: "pass" }],
        defaultOutcome: "fail",
      });
      const rs = parseRuleSet(json);
      expect(rs).not.toBeNull();
      expect(rs?.rules).toHaveLength(1);
      expect(rs?.defaultOutcome).toBe("fail");
    });

    it("returns null for invalid JSON", () => {
      expect(parseRuleSet("not json")).toBeNull();
    });

    it("returns null when rules is not an array", () => {
      expect(parseRuleSet(JSON.stringify({ rules: "bad" }))).toBeNull();
    });

    it("defaults to 'fail' when defaultOutcome is missing", () => {
      const rs = parseRuleSet(JSON.stringify({ rules: [] }));
      expect(rs?.defaultOutcome).toBe("fail");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap C — Trust bootstrapping
// ─────────────────────────────────────────────────────────────────────────────

import { calculateBootstrappedScore } from "../trust/bootstrap.js";

describe("Gap C — Trust bootstrapping protocol", () => {
  it("initial_score is always >= 2.5 (hard lower bound)", () => {
    const result = calculateBootstrappedScore({
      companyId:    "cc000000-0000-4000-8000-000000000003",
      skillType:    "send_email",
      industrySlug: "financial",
    });
    expect(result.initialScore).toBeGreaterThanOrEqual(2.5);
  });

  it("initial_score is always <= 3.9 (hard upper bound — cap at supervised)", () => {
    const result = calculateBootstrappedScore({
      companyId:    "cc000000-0000-4000-8000-000000000003",
      skillType:    "cv_qualification_analysis",
      industrySlug: "retail",
    });
    expect(result.initialScore).toBeLessThanOrEqual(3.9);
  });

  it("initial_score never >= 4.8 (autonomous tier forbidden at install)", () => {
    // Even with best-case inputs, must stay below autonomous threshold
    const result = calculateBootstrappedScore({
      companyId:    "cc000000-0000-4000-8000-000000000003",
      skillType:    "drafting_analysis",
      industrySlug: "professional_services",
    });
    expect(result.initialScore).toBeLessThan(4.8);
  });

  it("external send skills start lower than drafting skills", () => {
    const send = calculateBootstrappedScore({
      companyId: "cc000000-0000-4000-8000-000000000003",
      skillType: "send_email",
    });
    const draft = calculateBootstrappedScore({
      companyId: "cc000000-0000-4000-8000-000000000003",
      skillType: "cv_qualification_analysis",
    });
    expect(send.initialScore).toBeLessThanOrEqual(draft.initialScore);
  });

  it("financial industry scores lower than professional_services", () => {
    const finance = calculateBootstrappedScore({
      companyId:    "cc000000-0000-4000-8000-000000000003",
      industrySlug: "financial",
    });
    const consulting = calculateBootstrappedScore({
      companyId:    "cc000000-0000-4000-8000-000000000003",
      industrySlug: "professional_services",
    });
    expect(finance.initialScore).toBeLessThanOrEqual(consulting.initialScore);
  });

  it("returns all four components in the result", () => {
    const result = calculateBootstrappedScore({
      companyId: "cc000000-0000-4000-8000-000000000003",
    });
    expect(typeof result.components.packTrackRecord).toBe("number");
    expect(typeof result.components.taskTypeRisk).toBe("number");
    expect(typeof result.components.industryProfile).toBe("number");
    expect(typeof result.components.operatorHistory).toBe("number");
  });

  it("new company has operatorHistory = 0", () => {
    const result = calculateBootstrappedScore({
      companyId: "cc000000-0000-4000-8000-000000000003",
    });
    expect(result.components.operatorHistory).toBe(0);
  });

  it("score is stable (deterministic for same inputs)", () => {
    const a = calculateBootstrappedScore({
      companyId:    "cc000000-0000-4000-8000-000000000003",
      skillType:    "cv_qualification",
      industrySlug: "retail",
    });
    const b = calculateBootstrappedScore({
      companyId:    "cc000000-0000-4000-8000-000000000003",
      skillType:    "cv_qualification",
      industrySlug: "retail",
    });
    expect(a.initialScore).toBe(b.initialScore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap E — Zero-tolerance action classes
// ─────────────────────────────────────────────────────────────────────────────

import {
  checkZeroTolerance,
  ZeroToleranceViolation,
  type ZeroToleranceRule,
  type AgentAction,
} from "../safety/zero-tolerance.js";

describe("Gap E — Zero-tolerance action classes", () => {
  it("throws ZeroToleranceViolation for always condition", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "delete_record", condition: "always" },
    ];
    const action: AgentAction = { type: "delete_record", params: {} };

    expect(() => checkZeroTolerance(rules, action)).toThrow(ZeroToleranceViolation);
  });

  it("does not throw when action_type does not match", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "delete_record", condition: "always" },
    ];
    const action: AgentAction = { type: "send_email", params: {} };

    expect(() => checkZeroTolerance(rules, action)).not.toThrow();
  });

  it("throws for field comparison — recipient_count > 50", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "send_email", condition: "recipient_count > 50" },
    ];
    const action: AgentAction = { type: "send_email", params: { recipient_count: 75 } };

    expect(() => checkZeroTolerance(rules, action)).toThrow(ZeroToleranceViolation);
  });

  it("does not throw when field comparison is below threshold", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "send_email", condition: "recipient_count > 50" },
    ];
    const action: AgentAction = { type: "send_email", params: { recipient_count: 3 } };

    expect(() => checkZeroTolerance(rules, action)).not.toThrow();
  });

  it("supports >= operator", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "financial_commitment", condition: "amount >= 1000" },
    ];
    expect(() =>
      checkZeroTolerance(rules, { type: "financial_commitment", params: { amount: 1000 } })
    ).toThrow(ZeroToleranceViolation);
    expect(() =>
      checkZeroTolerance(rules, { type: "financial_commitment", params: { amount: 999 } })
    ).not.toThrow();
  });

  it("ZeroToleranceViolation carries actionType and reason", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "delete_record", condition: "always" },
    ];
    try {
      checkZeroTolerance(rules, { type: "delete_record", params: {} });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ZeroToleranceViolation);
      expect((e as ZeroToleranceViolation).actionType).toBe("delete_record");
      expect((e as ZeroToleranceViolation).reason).toBe("always");
    }
  });

  it("no-op for empty rules array", () => {
    expect(() =>
      checkZeroTolerance([], { type: "delete_record", params: {} })
    ).not.toThrow();
  });

  it("wildcard action_type '*' matches any action", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "*", condition: "always" },
    ];
    expect(() =>
      checkZeroTolerance(rules, { type: "anything", params: {} })
    ).toThrow(ZeroToleranceViolation);
  });

  it("first matching rule wins (stops after first violation)", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "send_email", condition: "recipient_count > 50" },
      { action_type: "send_email", condition: "always" },
    ];
    // recipient_count = 5 → first rule misses, second should still fire
    expect(() =>
      checkZeroTolerance(rules, { type: "send_email", params: { recipient_count: 5 } })
    ).toThrow(ZeroToleranceViolation);
  });

  it("context object values are accessible in conditions", () => {
    const rules: ZeroToleranceRule[] = [
      { action_type: "financial_commitment", condition: "threshold > 500" },
    ];
    const action: AgentAction = { type: "financial_commitment", params: {} };
    const context = { threshold: 1000 };

    expect(() => checkZeroTolerance(rules, action, context)).toThrow(ZeroToleranceViolation);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gap N — SLA tiers
// ─────────────────────────────────────────────────────────────────────────────

import { SLA_TIERS, getSla, recordSlaBreach } from "../billing/sla.js";

vi.mock("@paperclipai/db", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@paperclipai/db")>();
  return {
    ...orig,
    slaEvents: { id: "slaEvents", companyId: "companyId", eventType: "eventType",
                  creditDays: "creditDays", createdAt: "createdAt" },
    companies: { id: "companies" },
    eq:  (a: unknown, b: unknown) => ({ __eq: [a, b] }),
    and: (...args: unknown[])     => ({ __and: args }),
    gte: (a: unknown, b: unknown) => ({ __gte: [a, b] }),
  };
});

function makeSlaDb(existingCreditDays = 0) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(
            existingCreditDays > 0 ? [{ total: existingCreditDays }] : [],
          ),
        }),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve(),
    }),
  } as unknown as import("@paperclipai/db").Db;
}

describe("Gap N — SLA tiers", () => {
  it("SLA_TIERS has all 4 plan tiers", () => {
    expect(Object.keys(SLA_TIERS)).toEqual(["solo", "growth", "pro", "enterprise"]);
  });

  it("resolution hours decrease by tier (solo > growth > pro > enterprise)", () => {
    expect(SLA_TIERS.solo.resolution_hours).toBeGreaterThan(SLA_TIERS.growth.resolution_hours);
    expect(SLA_TIERS.growth.resolution_hours).toBeGreaterThan(SLA_TIERS.pro.resolution_hours);
    expect(SLA_TIERS.pro.resolution_hours).toBeGreaterThan(SLA_TIERS.enterprise.resolution_hours);
  });

  it("uptime_pct increases by tier", () => {
    expect(SLA_TIERS.enterprise.uptime_pct).toBeGreaterThan(SLA_TIERS.pro.uptime_pct);
    expect(SLA_TIERS.pro.uptime_pct).toBeGreaterThan(SLA_TIERS.growth.uptime_pct);
    expect(SLA_TIERS.growth.uptime_pct).toBeGreaterThan(SLA_TIERS.solo.uptime_pct);
  });

  it("exact SLA values match spec", () => {
    expect(SLA_TIERS.solo.resolution_hours).toBe(24);
    expect(SLA_TIERS.growth.resolution_hours).toBe(8);
    expect(SLA_TIERS.pro.resolution_hours).toBe(4);
    expect(SLA_TIERS.enterprise.resolution_hours).toBe(1);

    expect(SLA_TIERS.solo.uptime_pct).toBe(99.0);
    expect(SLA_TIERS.enterprise.uptime_pct).toBe(99.9);
  });

  it("getSla returns correct tier for known plans", () => {
    expect(getSla("solo")).toEqual(SLA_TIERS.solo);
    expect(getSla("enterprise")).toEqual(SLA_TIERS.enterprise);
  });

  it("getSla falls back to solo for unknown plans", () => {
    expect(getSla("unknown_plan")).toEqual(SLA_TIERS.solo);
    expect(getSla("")).toEqual(SLA_TIERS.solo);
  });

  it("recordSlaBreach returns creditDays = floor(breach hours)", async () => {
    const db = makeSlaDb(0);
    // threshold = 4h, actual = 6.5h → breach = 2.5h → credit = 2 days
    const { creditDays } = await recordSlaBreach(db, "comp-1", "pro", "resolution_time", 4, 6.5);
    expect(creditDays).toBe(2);
  });

  it("recordSlaBreach caps at 10 days/month when existing credits are near limit", async () => {
    const db = makeSlaDb(9); // already 9 days credited this month
    const { creditDays } = await recordSlaBreach(db, "comp-1", "growth", "resolution_time", 8, 20);
    // breach = 12h = 12 raw days, but capped to 10 - 9 = 1
    expect(creditDays).toBe(1);
  });

  it("recordSlaBreach gives 0 creditDays when monthly cap is exhausted", async () => {
    const db = makeSlaDb(10); // already at cap
    const { creditDays } = await recordSlaBreach(db, "comp-1", "solo", "resolution_time", 24, 48);
    expect(creditDays).toBe(0);
  });

  it("history_days increases by tier", () => {
    expect(SLA_TIERS.enterprise.history_days).toBeGreaterThan(SLA_TIERS.pro.history_days);
    expect(SLA_TIERS.pro.history_days).toBeGreaterThan(SLA_TIERS.growth.history_days);
    expect(SLA_TIERS.growth.history_days).toBeGreaterThan(SLA_TIERS.solo.history_days);
  });

  it("export_hours decreases by tier (faster export for higher tiers)", () => {
    expect(SLA_TIERS.enterprise.export_hours).toBeLessThan(SLA_TIERS.pro.export_hours);
    expect(SLA_TIERS.pro.export_hours).toBeLessThan(SLA_TIERS.growth.export_hours);
    expect(SLA_TIERS.growth.export_hours).toBeLessThan(SLA_TIERS.solo.export_hours);
  });
});
