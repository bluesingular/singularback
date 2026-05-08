/**
 * G8 — Task DAG route tests (tests 12–16)
 *
 * Service unit tests (1–11) are in singular-gap-g8-dag.test.ts
 */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("../tasks/dag.js", () => ({
  releaseBlockedTasks: vi.fn().mockResolvedValue([]),
  addDependency:       vi.fn().mockResolvedValue(undefined),
  removeDependency:    vi.fn().mockResolvedValue(undefined),
  getDagView:          vi.fn().mockResolvedValue({ upstream: [], downstream: [] }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_A     = "11111111-1111-4111-8111-111111111111";
const TASK_B     = "22222222-2222-4222-8222-222222222222";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ── App builder ───────────────────────────────────────────────────────────────

async function buildRouteApp(role: "operator" | "viewer" | "owner" = "operator") {
  const { taskDagRoutes } = await import("../routes/task-dag.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board", userId: USER_ID, companyIds: [COMPANY_ID],
      source: "jwt", isInstanceAdmin: false,
      memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: role }],
    };
    (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role, plan: "growth" };
    next();
  });
  app.use("/", taskDagRoutes({} as any));
  app.use(errorHandler);
  return app;
}

// ── Route tests ───────────────────────────────────────────────────────────────

describe("G8 — Task DAG routes", () => {
  it("12. POST .../tasks/:id/blocks — 201 creates dependency", async () => {
    const app = await buildRouteApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_A}/blocks`)
      .send({ downstreamTaskId: TASK_B });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.blockerId).toBe(TASK_A);
    expect(res.body.dependentId).toBe(TASK_B);
  });

  it("13. POST .../tasks/:id/blocks — 403 for viewer", async () => {
    const app = await buildRouteApp("viewer");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_A}/blocks`)
      .send({ downstreamTaskId: TASK_B });
    expect(res.status).toBe(403);
  });

  it("14. POST .../tasks/:id/blocks — 400 when taskId equals downstreamTaskId", async () => {
    const app = await buildRouteApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/tasks/${TASK_A}/blocks`)
      .send({ downstreamTaskId: TASK_A });
    expect(res.status).toBe(400);
  });

  it("15. DELETE .../tasks/:id/blocks/:downstreamId — 200", async () => {
    const app = await buildRouteApp("operator");
    const res = await request(app)
      .delete(`/companies/${COMPANY_ID}/tasks/${TASK_A}/blocks/${TASK_B}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("16. GET .../tasks/:id/dag — 200 returns dag view", async () => {
    const app = await buildRouteApp("operator");
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/tasks/${TASK_A}/dag`);
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBe(TASK_A);
    expect(res.body).toHaveProperty("upstream");
    expect(res.body).toHaveProperty("downstream");
  });
});
