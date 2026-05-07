/**
 * G5 — Human clarification flow
 *
 * Tests:
 *  1.  POST /issues/:issueId/clarification — 201, creates request
 *  2.  POST /issues/:issueId/clarification — 400 for missing question
 *  3.  POST /issues/:issueId/clarification — 404 when issue not found
 *  4.  POST /issues/:issueId/clarification — schedules timeout via emit
 *  5.  POST /issues/:issueId/clarification — uses company.clarificationTimeoutHours
 *  6.  POST /clarifications/:id/reply — 200, marks answered, cancels timeout
 *  7.  POST /clarifications/:id/reply — 409 when already answered
 *  8.  POST /clarifications/:id/reply — 404 when clarification not found
 *  9.  POST /clarifications/:id/reply — restores issue to in_progress (2 updates)
 * 10.  POST /clarifications/:id/reply — dispatches agent heartbeat when agentId set
 * 11.  POST /clarifications/:id/reply — no heartbeat when agentId is null
 * 12.  GET  /clarifications — returns list
 * 13.  GET  /clarifications?status=answered — returns answered list
 * 14.  POST /clarifications/:id/cancel — 200, cancels and blocks issue
 * 15.  POST /clarifications/:id/cancel — 409 when already answered
 * 16.  POST /clarifications/:id/cancel — viewer gets 403
 * 17.  POST /clarifications/:id/cancel — 404 when not found
 */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Mock emit + BullMQ/Redis ───────────────────────────────────────────────────

const mockEmit = {
  clarificationRequested:     vi.fn().mockResolvedValue(undefined),
  cancelClarificationTimeout: vi.fn().mockResolvedValue(undefined),
  heartbeat:                  vi.fn().mockResolvedValue(undefined),
};

vi.mock("../queue/emit.js", () => ({ emit: mockEmit }));
vi.mock("bullmq", () => ({
  Queue:  vi.fn().mockImplementation(() => ({ add: vi.fn(), getJob: vi.fn() })),
  Worker: vi.fn(),
}));
vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn(), quit: vi.fn(),
  })),
}));

// ── Fixture IDs ────────────────────────────────────────────────────────────────

const COMPANY_ID       = "c5000000-c500-4000-8000-c50000000000";
const USER_ID          = "u5000000-u500-4000-8000-u50000000000";
const ISSUE_ID         = "i5000000-i500-4000-8000-i50000000000";
const AGENT_ID         = "a5000000-a500-4000-8000-a50000000000";
const CLARIFICATION_ID = "ca500000-ca50-4000-8000-ca5000000000";

const PENDING_CLARIF = {
  id:         CLARIFICATION_ID,
  companyId:  COMPANY_ID,
  issueId:    ISSUE_ID,
  agentId:    AGENT_ID,
  question:   "Quel est le budget cible pour ce poste ?",
  status:     "pending",
  answer:     null,
  answeredBy: null,
  answeredAt: null,
};

const COMPANY_ROW = { clarificationTimeoutHours: 48 };
const ISSUE_ROW   = { id: ISSUE_ID, status: "in_progress", companyId: COMPANY_ID };

// ── DB mock ────────────────────────────────────────────────────────────────────
//
// selectQueue: each .select()...limit() call pops the next response array.
// listRows:    returned by .select()...where() without .limit() (GET list route).

function makeDb(
  selectQueue: (unknown[])[],
  listRows: unknown[] = [PENDING_CLARIF],
  insertResult: unknown = PENDING_CLARIF,
) {
  const queue = [...selectQueue];

  const db: any = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const rows = queue.shift() ?? [];
          return {
            limit: vi.fn().mockResolvedValue(rows),
            then:  (resolve: any, reject: any) =>
              Promise.resolve(listRows).then(resolve, reject),
          };
        }),
      }),
    })),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([insertResult]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
  return db;
}

// ── App builder ────────────────────────────────────────────────────────────────

type Role = "owner" | "admin" | "operator" | "viewer";

async function buildApp(role: Role, db: ReturnType<typeof makeDb>) {
  const { clarificationRoutes } = await import("../routes/clarifications.js");
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: USER_ID,
      companyIds: [COMPANY_ID],
      source: "jwt",
      isInstanceAdmin: false,
      memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: role }],
    };
    (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role, plan: "growth" };
    next();
  });

  app.use("/api/v1", clarificationRoutes(db as any));
  app.use(errorHandler);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("G5 - Human clarification flow", () => {
  beforeEach(() => vi.clearAllMocks());

  // Ask (create clarification)

  it("1. POST /issues/:id/clarification - 201, creates request", async () => {
    const db = makeDb([[COMPANY_ROW], [ISSUE_ROW]]);
    const app = await buildApp("operator", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/issues/${ISSUE_ID}/clarification`)
      .send({ question: "Quel est le budget cible ?", agentId: AGENT_ID });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe("pending");
  });

  it("2. POST /issues/:id/clarification - 400 for missing question", async () => {
    const db = makeDb([]);
    const app = await buildApp("operator", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/issues/${ISSUE_ID}/clarification`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("3. POST /issues/:id/clarification - 404 when issue not found", async () => {
    const db = makeDb([[COMPANY_ROW], []]);
    const app = await buildApp("operator", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/issues/${ISSUE_ID}/clarification`)
      .send({ question: "Budget ?" });
    expect(res.status).toBe(404);
  });

  it("4. POST /issues/:id/clarification - schedules timeout via emit", async () => {
    const db = makeDb([[COMPANY_ROW], [ISSUE_ROW]]);
    const app = await buildApp("operator", db);
    await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/issues/${ISSUE_ID}/clarification`)
      .send({ question: "Budget ?" });
    expect(mockEmit.clarificationRequested).toHaveBeenCalledOnce();
    const call = mockEmit.clarificationRequested.mock.calls[0][0];
    expect(call.companyId).toBe(COMPANY_ID);
    expect(call.issueId).toBe(ISSUE_ID);
  });

  it("5. POST /issues/:id/clarification - uses company.clarificationTimeoutHours", async () => {
    const db = makeDb([[{ clarificationTimeoutHours: 24 }], [ISSUE_ROW]]);
    const app = await buildApp("operator", db);
    await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/issues/${ISSUE_ID}/clarification`)
      .send({ question: "Budget ?" });
    const call = mockEmit.clarificationRequested.mock.calls[0][0];
    expect(call.timeoutHours).toBe(24);
  });

  // Reply

  it("6. POST /clarifications/:id/reply - 200, marks answered, cancels timeout", async () => {
    const db = makeDb([[PENDING_CLARIF]]);
    const app = await buildApp("operator", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/reply`)
      .send({ answer: "Le budget est 55 000 euros brut." });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEmit.cancelClarificationTimeout).toHaveBeenCalledWith(CLARIFICATION_ID);
  });

  it("7. POST /clarifications/:id/reply - 409 when already answered", async () => {
    const db = makeDb([[{ ...PENDING_CLARIF, status: "answered" }]]);
    const app = await buildApp("operator", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/reply`)
      .send({ answer: "Reponse." });
    expect(res.status).toBe(409);
  });

  it("8. POST /clarifications/:id/reply - 404 when clarification not found", async () => {
    const db = makeDb([[]]);
    const app = await buildApp("operator", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/reply`)
      .send({ answer: "Reponse." });
    expect(res.status).toBe(404);
  });

  it("9. POST /clarifications/:id/reply - 2 DB updates (clarif + issue)", async () => {
    const db = makeDb([[PENDING_CLARIF]]);
    const app = await buildApp("operator", db);
    await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/reply`)
      .send({ answer: "Budget 55k." });
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("10. POST /clarifications/:id/reply - dispatches heartbeat when agentId set", async () => {
    const db = makeDb([[{ ...PENDING_CLARIF, agentId: AGENT_ID }]]);
    const app = await buildApp("operator", db);
    await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/reply`)
      .send({ answer: "Budget 55k." });
    expect(mockEmit.heartbeat).toHaveBeenCalledOnce();
    expect(mockEmit.heartbeat.mock.calls[0][0].agentId).toBe(AGENT_ID);
  });

  it("11. POST /clarifications/:id/reply - no heartbeat when agentId is null", async () => {
    const db = makeDb([[{ ...PENDING_CLARIF, agentId: null }]]);
    const app = await buildApp("operator", db);
    await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/reply`)
      .send({ answer: "Budget 55k." });
    expect(mockEmit.heartbeat).not.toHaveBeenCalled();
  });

  // List

  it("12. GET /clarifications - returns list", async () => {
    const db = makeDb([], [PENDING_CLARIF]);
    const app = await buildApp("viewer", db);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/clarifications`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("13. GET /clarifications?status=answered - returns answered list", async () => {
    const answered = { ...PENDING_CLARIF, status: "answered", answer: "Budget 55k." };
    const db = makeDb([], [answered]);
    const app = await buildApp("viewer", db);
    const res = await request(app)
      .get(`/api/v1/companies/${COMPANY_ID}/clarifications?status=answered`);
    expect(res.status).toBe(200);
  });

  // Cancel

  it("14. POST /clarifications/:id/cancel - 200, cancels and blocks issue", async () => {
    const db = makeDb([[PENDING_CLARIF]]);
    const app = await buildApp("admin", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEmit.cancelClarificationTimeout).toHaveBeenCalledWith(CLARIFICATION_ID);
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("15. POST /clarifications/:id/cancel - 409 when already answered", async () => {
    const db = makeDb([[{ ...PENDING_CLARIF, status: "answered" }]]);
    const app = await buildApp("admin", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/cancel`);
    expect(res.status).toBe(409);
  });

  it("16. POST /clarifications/:id/cancel - viewer gets 403", async () => {
    const db = makeDb([]);
    const app = await buildApp("viewer", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/cancel`);
    expect(res.status).toBe(403);
  });

  it("17. POST /clarifications/:id/cancel - 404 when not found", async () => {
    const db = makeDb([[]]);
    const app = await buildApp("admin", db);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/clarifications/${CLARIFICATION_ID}/cancel`);
    expect(res.status).toBe(404);
  });
});
