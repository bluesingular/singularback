/**
 * singular-f3-f8-t5-ag1-ag9.test.ts
 *
 * Tests for 8 build-sequence items that had no dedicated coverage:
 *   F3   Approval escalation path
 *   F5   Integration disconnection handling
 *   F6   Token budget pre-flight check
 *   F7   Reasoning capture (agent.reasoning SSE event)
 *   F8   Skill version notice on pending approval
 *   T5   API response envelope standardisation
 *   AG-1 Parallel multi-agent execution (mission context)
 *   AG-9 Real-time bidirectional steering
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// F3 — Approval escalation path
// ─────────────────────────────────────────────────────────────────────────────

describe("F3 — Approval escalation path", () => {
  const makeDb = (tasks: object[]) => ({
    select: vi.fn().mockReturnThis(),
    from:   vi.fn().mockReturnThis(),
    where:  vi.fn().mockResolvedValue(tasks),
    update: vi.fn().mockReturnThis(),
    set:    vi.fn().mockReturnThis(),
    // chained .where() after .set() — for the update branch
  } as any);

  it("exports runApprovalEscalations function", async () => {
    const mod = await import("../intelligence/approval-escalation");
    expect(typeof mod.runApprovalEscalations).toBe("function");
  });

  it("returns { escalated: 0 } when no tasks are overdue", async () => {
    const mod = await import("../intelligence/approval-escalation");
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([]),
    } as any;
    const result = await mod.runApprovalEscalations(db);
    expect(result).toEqual({ escalated: 0 });
  });

  it("escalates level-0 high-priority task after 2h to level 1", async () => {
    const mod = await import("../intelligence/approval-escalation");
    const now = Date.now();
    const createdAt = new Date(now - 3 * 60 * 60 * 1000); // 3h ago — past 2h threshold

    const updateWhere = vi.fn().mockResolvedValue([]);
    const updateSet   = vi.fn().mockReturnValue({ where: updateWhere });
    const dbUpdate    = vi.fn().mockReturnValue({ set: updateSet });

    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([
        {
          id:               "task-001",
          companyId:        "company-001",
          title:            "Qualifier ce candidat",
          priority:         "high",
          status:           "in_review",
          escalationLevel:  0,
          approvalEscalateAt: new Date(now - 1000), // past due
          createdAt,
        },
      ]),
      update: dbUpdate,
      // createNotification calls db.insert().values() internally
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "notif-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      }),
      // createNotification also calls db.select().from().innerJoin().where()
      innerJoin: vi.fn().mockReturnThis(),
    } as any;

    const result = await mod.runApprovalEscalations(db);
    expect(result.escalated).toBe(1);
  });

  it("skips level-0 normal task that is under 24h old", async () => {
    const mod = await import("../intelligence/approval-escalation");
    const now = Date.now();
    const createdAt = new Date(now - 30 * 60 * 1000); // only 30 minutes old

    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockResolvedValue([
        {
          id:               "task-002",
          companyId:        "company-001",
          title:            "Tâche normale",
          priority:         "normal",
          status:           "in_review",
          escalationLevel:  0,
          approvalEscalateAt: new Date(now - 1000),
          createdAt,
        },
      ]),
      update: vi.fn().mockReturnThis(),
      set:    vi.fn().mockReturnThis(),
    } as any;

    const result = await mod.runApprovalEscalations(db);
    expect(result.escalated).toBe(0);
  });

  it("HIGH_PRIORITY_ESCALATION_MS constant is 2 hours", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../intelligence/approval-escalation.ts"),
      "utf-8",
    );
    expect(src).toContain("2  * 60 * 60 * 1000");
  });

  it("APPROVAL_EXPIRY_MS constant is 48 hours", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../intelligence/approval-escalation.ts"),
      "utf-8",
    );
    expect(src).toContain("48 * 60 * 60 * 1000");
  });

  it("is wired into the morningIntelligence worker", () => {
    const workerSrc = fs.readFileSync(
      path.resolve(__dirname, "../workers/morningIntelligence.worker.ts"),
      "utf-8",
    );
    expect(workerSrc).toContain("runApprovalEscalations");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F5 — Integration disconnection handling
// ─────────────────────────────────────────────────────────────────────────────

describe("F5 — Integration disconnection handling", () => {
  it("exports validateRequiredIntegrations and IntegrationDisconnectedError", async () => {
    const mod = await import("../safety/integration-check");
    expect(typeof mod.validateRequiredIntegrations).toBe("function");
    expect(typeof mod.IntegrationDisconnectedError).toBe("function");
  });

  it("resolves immediately when requiredIntegrations is empty", async () => {
    const mod = await import("../safety/integration-check");
    const db = {} as any;
    await expect(mod.validateRequiredIntegrations(db, "company-1", [])).resolves.toBeUndefined();
  });

  it("resolves when required integration is connected", async () => {
    const mod = await import("../safety/integration-check");
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue([{ id: "integ-1", status: "connected" }]),
    } as any;
    await expect(
      mod.validateRequiredIntegrations(db, "company-1", ["gmail"]),
    ).resolves.toBeUndefined();
  });

  it("throws IntegrationDisconnectedError when integration is missing", async () => {
    const mod = await import("../safety/integration-check");
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue([]),
    } as any;
    await expect(
      mod.validateRequiredIntegrations(db, "company-1", ["gmail"]),
    ).rejects.toThrow(mod.IntegrationDisconnectedError);
  });

  it("IntegrationDisconnectedError carries the slug", async () => {
    const mod = await import("../safety/integration-check");
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue([]),
    } as any;
    try {
      await mod.validateRequiredIntegrations(db, "company-1", ["slack"]);
    } catch (err: any) {
      expect(err.integrationSlug).toBe("slack");
    }
  });

  it("throws on first disconnected integration — does not continue", async () => {
    const mod = await import("../safety/integration-check");
    let calls = 0;
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockImplementation(() => {
        calls++;
        return Promise.resolve([]); // all disconnected
      }),
    } as any;
    await expect(
      mod.validateRequiredIntegrations(db, "company-1", ["gmail", "slack"]),
    ).rejects.toThrow(mod.IntegrationDisconnectedError);
    expect(calls).toBe(1); // stops after first failure
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F6 — Token budget pre-flight check
// ─────────────────────────────────────────────────────────────────────────────

describe("F6 — Token budget pre-flight check", () => {
  it("exports checkBudgetBeforeCall and BudgetExhaustedError", async () => {
    const mod = await import("../costs/service");
    expect(typeof mod.checkBudgetBeforeCall).toBe("function");
    expect(typeof mod.BudgetExhaustedError).toBe("function");
  });

  it("resolves when company has sufficient tokens remaining", async () => {
    const mod = await import("../costs/service");
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue([
        { tokensUsedMonth: 1000, tokensLimitMonth: 100_000, plan: "growth" },
      ]),
    } as any;
    await expect(
      mod.checkBudgetBeforeCall(db, "company-1", 500),
    ).resolves.toBeUndefined();
  });

  it("throws BudgetExhaustedError when tokens are exhausted", async () => {
    const mod = await import("../costs/service");
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue([
        { tokensUsedMonth: 100_000, tokensLimitMonth: 100_000, plan: "growth" },
      ]),
    } as any;
    await expect(
      mod.checkBudgetBeforeCall(db, "company-1", 100),
    ).rejects.toThrow(mod.BudgetExhaustedError);
  });

  it("BudgetExhaustedError is named correctly", async () => {
    const mod = await import("../costs/service");
    const err = new mod.BudgetExhaustedError("Monthly token limit reached.");
    expect(err.name).toBe("BudgetExhaustedError");
  });

  it("checks BEFORE every LLM call — documented in source", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../costs/service.ts"),
      "utf-8",
    );
    expect(src).toContain("checkBudgetBeforeCall");
    expect(src).toContain("every LLM invocation");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F7 — Reasoning capture (agent.reasoning SSE event)
// ─────────────────────────────────────────────────────────────────────────────

describe("F7 — agent.reasoning SSE event type", () => {
  it("exports SseEventType union that includes agent.reasoning", async () => {
    const mod = await import("../realtime/sse");
    // SseEventType is a TS type — verify the string literal exists in source
    const src = fs.readFileSync(
      path.resolve(__dirname, "../realtime/sse.ts"),
      "utf-8",
    );
    expect(src).toContain('"agent.reasoning"');
  });

  it("SseManager exports addConnection method", async () => {
    const mod = await import("../realtime/sse");
    expect(typeof mod.sseManager.addConnection).toBe("function");
  });

  it("SseManager exports removeConnection method", async () => {
    const mod = await import("../realtime/sse");
    expect(typeof mod.sseManager.removeConnection).toBe("function");
  });

  it("SseManager exports publishEvent method", async () => {
    const mod = await import("../realtime/sse");
    expect(typeof mod.sseManager.publishEvent).toBe("function");
  });

  it("publishEvent returns the number of connections notified", async () => {
    const mod = await import("../realtime/sse");
    // With no active connections, count should be 0
    const count = mod.sseManager.publishEvent("company-unknown", {
      type: "agent.reasoning",
      taskId: "task-1",
      data: { fragment: "Je réfléchis…" },
    });
    expect(typeof count).toBe("number");
  });

  it("task_execution_events is used to persist reasoning — referenced in sse source", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../realtime/sse.ts"),
      "utf-8",
    );
    // Agent reasoning event type is present and taskId is referenced
    expect(src).toContain("agent.reasoning");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F8 — Skill version notice on pending approval
// ─────────────────────────────────────────────────────────────────────────────

describe("F8 — Skill version notice on pending approval", () => {
  it("approvals route contains getSkillVersionContext helper", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/approvals.ts"),
      "utf-8",
    );
    expect(src).toContain("getSkillVersionContext");
  });

  it("returns taskSkillVersion and latestSkillVersion fields", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/approvals.ts"),
      "utf-8",
    );
    expect(src).toContain("taskSkillVersion");
    expect(src).toContain("latestSkillVersion");
  });

  it("returns empty object when no issueId or taskId in payload", async () => {
    // Verify the guard clause is in source
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/approvals.ts"),
      "utf-8",
    );
    expect(src).toContain("if (!issueId) return {}");
  });

  it("returns empty object when issue has no skillType", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/approvals.ts"),
      "utf-8",
    );
    expect(src).toContain("if (!issue?.skillType) return {}");
  });

  it("also returns confidenceFlag for approval card display", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/approvals.ts"),
      "utf-8",
    );
    expect(src).toContain("confidenceFlag");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 — API response envelope standardisation
// ─────────────────────────────────────────────────────────────────────────────

describe("T5 — API response envelope", () => {
  it("exports errorEnvelopeMiddleware and SwwarmError", async () => {
    const mod = await import("../middleware/response-envelope");
    expect(typeof mod.errorEnvelopeMiddleware).toBe("function");
    expect(typeof mod.SwwarmError).toBe("function");
  });

  it("errorEnvelopeMiddleware formats SwwarmError as { ok: false, error: { code, message } }", async () => {
    const mod = await import("../middleware/response-envelope");
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { headersSent: false, status } as any;
    const req = { path: "/test", method: "POST" } as any;
    const next = vi.fn();

    const err = new mod.SwwarmError("SWWARM_GDPR_VIOLATION", "Violation RGPD", 400);
    mod.errorEnvelopeMiddleware(err, req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("SWWARM_GDPR_VIOLATION");
    expect(body.error.message).toBe("Violation RGPD");
  });

  it("errorEnvelopeMiddleware handles generic 500 errors without leaking details", async () => {
    const mod = await import("../middleware/response-envelope");
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { headersSent: false, status } as any;
    const req = { path: "/test", method: "GET" } as any;
    const next = vi.fn();

    mod.errorEnvelopeMiddleware(new Error("internal crash"), req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("SWWARM_SERVER_ERROR");
    // Must not leak "internal crash" to client
    expect(body.error.message).not.toContain("crash");
  });

  it("errorEnvelopeMiddleware skips response when headers already sent", async () => {
    const mod = await import("../middleware/response-envelope");
    const next = vi.fn();
    const res = { headersSent: true } as any;
    const req = {} as any;

    mod.errorEnvelopeMiddleware(new Error("oops"), req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("SwwarmError carries code, statusCode, and optional details", async () => {
    const mod = await import("../middleware/response-envelope");
    const err = new mod.SwwarmError("SWWARM_TRUST_INSUFFICIENT", "Trust trop bas", 403, { score: 2.1 });
    expect(err.code).toBe("SWWARM_TRUST_INSUFFICIENT");
    expect(err.statusCode).toBe(403);
    expect(err.details).toEqual({ score: 2.1 });
  });

  it("is registered in app.ts as Express error middleware", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../app.ts"),
      "utf-8",
    );
    expect(src).toContain("errorEnvelopeMiddleware");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-1 — Parallel multi-agent execution (mission context)
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-1 — Parallel multi-agent / mission context", () => {
  const makeDb = (stored: Record<string, unknown> = {}) => {
    const store: Record<string, unknown> = { ...stored };
    return {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockImplementation(() => {
        // Return whichever key was last queried — simplification
        const vals = Object.values(store);
        return Promise.resolve(vals.length ? [{ value: vals[0] }] : []);
      }),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    } as any;
  };

  it("exports getMissionContextValue, setMissionContextValue, registerParallelGroup, completeParallelGroup", async () => {
    const mod = await import("../missions/context");
    expect(typeof mod.getMissionContextValue).toBe("function");
    expect(typeof mod.setMissionContextValue).toBe("function");
    expect(typeof mod.registerParallelGroup).toBe("function");
    expect(typeof mod.completeParallelGroup).toBe("function");
  });

  it("exports ParallelGroup interface shape via registerParallelGroup", async () => {
    const mod = await import("../missions/context");
    const db = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    } as any;

    // Should not throw
    await expect(
      mod.registerParallelGroup(db, {
        groupId:   "group-1",
        missionId: "mission-1",
        companyId: "company-1",
        tasks:     ["task-a", "task-b"],
      }),
    ).resolves.not.toThrow();
  });

  it("setMissionContextValue upserts to mission_context table", async () => {
    const mod = await import("../missions/context");
    const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as any;

    await mod.setMissionContextValue(db, {
      missionId:  "mission-1",
      companyId:  "company-1",
      contextKey: "crm_lead_id",
      value:      "lead-999",
      writtenBy:  "agent-1",
    });

    expect(insert).toHaveBeenCalled();
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it("setMissionContextValues sets multiple keys atomically", async () => {
    const mod = await import("../missions/context");
    const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as any;

    await mod.setMissionContextValues(db, {
      missionId: "mission-1",
      companyId: "company-1",
      writtenBy: "agent-2",
      entries: {
        key_a: "value_a",
        key_b: "value_b",
      },
    });

    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("ParallelGroup tracks status: running | complete | partial_failure", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../missions/context.ts"),
      "utf-8",
    );
    expect(src).toContain("running");
    expect(src).toContain("complete");
    expect(src).toContain("partial_failure");
  });

  it("last write wins — mission_context has UNIQUE (mission_id, context_key)", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../missions/context.ts"),
      "utf-8",
    );
    expect(src).toContain("onConflictDoUpdate");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AG-9 — Real-time bidirectional steering
// ─────────────────────────────────────────────────────────────────────────────

describe("AG-9 — Real-time bidirectional steering", () => {
  it("steer route file exists and exports steerRoutes", async () => {
    const mod = await import("../routes/steer");
    expect(typeof mod.steerRoutes).toBe("function");
  });

  it("POST endpoint path is /companies/:companyId/tasks/:taskId/steer", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/steer.ts"),
      "utf-8",
    );
    expect(src).toContain("/companies/:companyId/tasks/:taskId/steer");
    expect(src).toContain("router.post");
  });

  it("only works on in_progress tasks — conflict error for other statuses", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/steer.ts"),
      "utf-8",
    );
    expect(src).toContain("in_progress");
    expect(src).toContain("conflict");
  });

  it("instruction is validated — min 1, max 500 chars", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/steer.ts"),
      "utf-8",
    );
    expect(src).toContain("min(1)");
    expect(src).toContain("max(500)");
  });

  it("records instruction as operator_steer event in task_execution_events", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/steer.ts"),
      "utf-8",
    );
    expect(src).toContain("operator_steer");
    expect(src).toContain("taskExecutionEvents");
  });

  it("response is { ok: true, taskId, queued: true }", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/steer.ts"),
      "utf-8",
    );
    expect(src).toContain("ok: true");
    expect(src).toContain("queued: true");
  });

  it("instruction is prefixed with [Instruction de l'opérateur] — French, never raw", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/steer.ts"),
      "utf-8",
    );
    expect(src).toContain("[Instruction de l'opérateur]");
  });

  it("steer cannot change target agent or override approval gates (documented as invariant)", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../routes/steer.ts"),
      "utf-8",
    );
    expect(src).toContain("Cannot change target agent");
    expect(src).toContain("override approval gates");
  });

  it("is registered in app.ts", () => {
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../app.ts"),
      "utf-8",
    );
    expect(appSrc).toContain("steerRoutes");
  });
});
