/**
 * M6 — Quality Gates + Output Schema Validation + Damage Control
 *
 * Tests:
 *  1. validateOutputSchema: all required fields present → valid
 *  2. validateOutputSchema: missing required field → invalid with error
 *  3. validateOutputSchema: wrong type → invalid with error
 *  4. validateOutputSchema: number out of range → invalid
 *  5. validateOutputSchema: enum violation → invalid
 *  6. formatCorrectionPrompt: formats errors into readable prompt
 *  7. runGates: no gates → passes, audit entry written
 *  8. runGates: volume_limit within limit → passes
 *  9. runGates: volume_limit over limit → blocked, violation + audit written
 * 10. runGates: content_forbidden match → escalated
 * 11. runGates: recipient_whitelist blocked domain → blocked
 * 12. runGates: recipient_whitelist allowed domain → passes
 * 13. runGates: budget_limit exhausted → escalated
 * 14. runGates: first gate passes, second blocks → stops at second
 * 15. initiateDamageControl: creates event, audit entry, memory entry
 * 16. Audit migration SQL contains immutable RULE statements (structural)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Schema validation ─────────────────────────────────────────────────────────

import {
  validateOutputSchema,
  formatCorrectionPrompt,
} from "../gates/schema.js";

const CV_SCHEMA = {
  type: "object",
  required: ["candidate_name", "score", "recommendation"],
  properties: {
    candidate_name: { type: "string" },
    score: { type: "number", minimum: 1, maximum: 5 },
    key_strengths: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
    recommendation: {
      type: "string",
      enum: ["proceed", "reject", "review"],
    },
  },
};

describe("validateOutputSchema", () => {
  it("1. all required fields present → valid", () => {
    const result = validateOutputSchema(
      { candidate_name: "Jean Dupont", score: 4, recommendation: "proceed" },
      CV_SCHEMA,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("2. missing required field → invalid with field name in error", () => {
    const result = validateOutputSchema(
      { candidate_name: "Jean Dupont", score: 4 }, // missing recommendation
      CV_SCHEMA,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "recommendation")).toBe(true);
  });

  it("3. wrong type → invalid", () => {
    const result = validateOutputSchema(
      { candidate_name: 123, score: 4, recommendation: "proceed" }, // name should be string
      CV_SCHEMA,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "candidate_name")).toBe(true);
  });

  it("4. number out of range → invalid", () => {
    const result = validateOutputSchema(
      { candidate_name: "Jean", score: 6, recommendation: "proceed" }, // score max is 5
      CV_SCHEMA,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "score")).toBe(true);
  });

  it("5. enum violation → invalid", () => {
    const result = validateOutputSchema(
      { candidate_name: "Jean", score: 3, recommendation: "maybe" }, // not in enum
      CV_SCHEMA,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "recommendation")).toBe(true);
  });

  it("6. formatCorrectionPrompt: produces readable correction request", () => {
    const errors = [
      { field: "recommendation", message: "must be equal to one of the allowed values" },
      { field: "score", message: "must be <= 5" },
    ];
    const prompt = formatCorrectionPrompt(errors);
    expect(prompt).toContain("recommendation");
    expect(prompt).toContain("score");
    expect(prompt).toContain("correct");
  });
});

// ── Gate engine ───────────────────────────────────────────────────────────────

import { runGates } from "../gates/engine.js";

function baseParams() {
  return {
    companyId:  "company-1",
    agentId:    "agent-1",
    taskId:     "task-1",
    actionType: "send_email" as const,
    actionData: { to: "candidate@example.com", content: "Hello there" },
  };
}

function makeGatesDb(opts: {
  gates?: object[];
  todayCount?: number;
  agentBudget?: { budgetUsedMonth: string; budgetLimitMonth: string };
}) {
  let selectCall = 0;
  // insertValues is used as the .values() function; it returns an object
  // with both .returning() (for createNotification) and resolves directly
  // (for legacy insert paths that don't chain .returning).
  const insertValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "mock-notif-id" }]),
    then: (resolve: (v: undefined) => void) => Promise.resolve(undefined).then(resolve),
  });

  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // getActiveGates query
          return Promise.resolve(opts.gates ?? []);
        }
        if (opts.agentBudget) {
          // budget_limit: agent row
          return { limit: vi.fn().mockResolvedValue([opts.agentBudget]) };
        }
        // volume_limit: count query
        return Promise.resolve([{ count: opts.todayCount ?? 0 }]);
      }),
    })),
    insert: vi.fn().mockReturnValue({ values: insertValues }),
  };

  return { db: db as any, insertValues };
}

describe("runGates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("7. no gates configured → passes, audit entry written with result=success", async () => {
    const { db, insertValues } = makeGatesDb({ gates: [] });
    const result = await runGates(db, baseParams());

    expect(result.passed).toBe(true);
    expect(insertValues).toHaveBeenCalledOnce();
    expect(insertValues.mock.calls[0][0].result).toBe("success");
  });

  it("8. volume_limit within limit → passes", async () => {
    const { db } = makeGatesDb({
      gates: [{ id: "gate-1", gateType: "volume_limit", agentId: "agent-1", config: { maxPerDay: 50 } }],
      todayCount: 10,
    });
    const result = await runGates(db, baseParams());
    expect(result.passed).toBe(true);
  });

  it("9. volume_limit over limit → blocked, violation + audit written", async () => {
    const { db, insertValues } = makeGatesDb({
      gates: [{ id: "gate-1", gateType: "volume_limit", agentId: "agent-1", config: { maxPerDay: 50 } }],
      todayCount: 50,
    });
    const result = await runGates(db, baseParams());

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.action).toBe("block");
      expect(result.reason).toContain("50");
    }
    // violation insert + audit insert
    expect(insertValues).toHaveBeenCalledTimes(2);
    const auditCall = insertValues.mock.calls[1][0];
    expect(auditCall.result).toBe("blocked");
  });

  it("10. content_forbidden match → escalated", async () => {
    const { db, insertValues } = makeGatesDb({
      gates: [{
        id: "gate-2",
        gateType: "content_forbidden",
        agentId: null,
        config: { terms: ["urgent", "guaranteed"] },
      }],
    });
    const result = await runGates(db, {
      ...baseParams(),
      actionData: { content: "This is URGENT — guaranteed results!" },
    });

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.action).toBe("escalate");
      expect(result.reason).toContain("urgent");
    }
    const auditCall = insertValues.mock.calls[1][0];
    expect(auditCall.result).toBe("escalated");
  });

  it("11. recipient_whitelist blocked domain → blocked", async () => {
    const { db } = makeGatesDb({
      gates: [{
        id: "gate-3",
        gateType: "recipient_whitelist",
        agentId: null,
        config: { allowedDomains: ["acme.com", "partner.fr"] },
      }],
    });
    const result = await runGates(db, {
      ...baseParams(),
      actionData: { to: "candidate@evil.com" },
    });

    expect(result.passed).toBe(false);
    if (!result.passed) expect(result.action).toBe("block");
  });

  it("12. recipient_whitelist allowed domain → passes", async () => {
    const { db } = makeGatesDb({
      gates: [{
        id: "gate-3",
        gateType: "recipient_whitelist",
        agentId: null,
        config: { allowedDomains: ["acme.com", "partner.fr"] },
      }],
    });
    const result = await runGates(db, {
      ...baseParams(),
      actionData: { to: "hr@acme.com" },
    });
    expect(result.passed).toBe(true);
  });

  it("13. budget_limit exhausted → escalated", async () => {
    const { db } = makeGatesDb({
      gates: [{
        id: "gate-4",
        gateType: "budget_limit",
        agentId: "agent-1",
        config: {},
      }],
      agentBudget: { spentMonthlyCents: 500, budgetMonthlyCents: 500 },
    });
    const result = await runGates(db, baseParams());
    expect(result.passed).toBe(false);
    if (!result.passed) expect(result.action).toBe("escalate");
  });

  it("14. first gate passes, second blocks — stops at second", async () => {
    const { db, insertValues } = makeGatesDb({
      gates: [
        { id: "gate-1", gateType: "recipient_whitelist", agentId: null, config: { allowedDomains: ["example.com"] } },
        { id: "gate-2", gateType: "content_forbidden", agentId: null, config: { terms: ["forbidden"] } },
      ],
    });
    const result = await runGates(db, {
      ...baseParams(),
      actionData: { to: "user@example.com", content: "this is forbidden content" },
    });

    expect(result.passed).toBe(false);
    // 3 inserts: violation + audit + notification (content_forbidden escalates)
    expect(insertValues).toHaveBeenCalledTimes(3);
  });
});

// ── Damage control ────────────────────────────────────────────────────────────

import { initiateDamageControl } from "../gates/damageControl.js";

function makeDamageDb() {
  const returning = vi.fn().mockResolvedValue([{
    id:              "dce-1",
    companyId:       "company-1",
    agentId:         "agent-1",
    taskId:          "task-1",
    errorType:       "wrong_tone",
    status:          "in_progress",
    recoveryActions: ["draft_correction"],
  }]);
  const insertValues = vi.fn().mockReturnValue({ returning });
  const insertValuesNoReturn = vi.fn().mockResolvedValue(undefined);

  let insertCall = 0;
  const db = {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => {
        insertCall++;
        if (insertCall === 1) return { returning };
        return { returning: vi.fn().mockResolvedValue([{}]), then: (r: unknown) => Promise.resolve(r) };
      }),
    })),
  };

  // Simpler: all inserts return chainable mock
  const insertValuesMock = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{
      id: "dce-1", companyId: "company-1", agentId: "agent-1", taskId: "task-1",
      errorType: "wrong_tone", status: "in_progress", recoveryActions: ["draft_correction"],
    }]),
  });
  const db2 = {
    insert: vi.fn().mockReturnValue({ values: insertValuesMock }),
  };

  return { db: db2 as any, insertValuesMock };
}

describe("initiateDamageControl", () => {
  it("15. creates damage control event, audit entry, and memory entry", async () => {
    const { db, insertValuesMock } = makeDamageDb();

    const event = await initiateDamageControl(db, {
      companyId:       "company-1",
      agentId:         "agent-1",
      taskId:          "task-1",
      errorType:       "wrong_tone",
      recoveryActions: ["draft_correction", "mark_sensitive"],
      contactName:     "Marie Martin",
      topic:           "job interview scheduling",
    });

    expect(event.id).toBe("dce-1");
    expect(event.errorType).toBe("wrong_tone");
    expect(event.status).toBe("in_progress");

    // insert called 3 times: damage_control_events, audit_entries, memory_entries
    expect(db.insert).toHaveBeenCalledTimes(3);

    // Memory entry should mention the contact name
    const memoryInsertArgs = insertValuesMock.mock.calls[2][0];
    expect(memoryInsertArgs.content).toContain("Marie Martin");
    expect(memoryInsertArgs.importance).toBe(5); // highest importance
  });
});

// ── Structural: immutable audit trail ────────────────────────────────────────

describe("audit trail immutability", () => {
  it("16. migration SQL contains DB-level RULE preventing UPDATE and DELETE", () => {
    const migrationPath = join(
      __dirname,
      "../../../packages/db/src/migrations/0060_singular_quality_gates.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("audit_no_update");
    expect(sql).toContain("audit_no_delete");
    expect(sql).toContain("DO INSTEAD NOTHING");
  });
});
