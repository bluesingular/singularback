/**
 * G9 — Batch processing route tests (tests 11–14)
 *
 * Service unit tests (1–10) are in singular-gap-g9-batch.test.ts
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("../batch/runner.js", () => ({
  createBatch:    vi.fn(),
  getBatchStatus: vi.fn(),
  approveBatch:   vi.fn(),
  rejectBatch:    vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BATCH_ID   = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SKILL_TYPE = "data-analysis";
const ITEMS      = [{ url: "https://example.com/1" }, { url: "https://example.com/2" }];

const BATCH_STATUS = {
  id:              BATCH_ID,
  companyId:       COMPANY_ID,
  skillType:       SKILL_TYPE,
  status:          "awaiting_approval",
  itemCount:       2,
  completedCount:  2,
  failedCount:     0,
  createdAt:       new Date("2026-05-07T00:00:00Z"),
  approvedAt:      null,
  approvedByUserId: null,
};

// ── App builder ───────────────────────────────────────────────────────────────

async function buildRouteApp(role: "operator" | "viewer" | "owner" = "operator") {
  const { batchRoutes } = await import("../routes/batch.js");
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
  app.use("/", batchRoutes({} as any));
  app.use(errorHandler);
  return app;
}

// ── Route tests ───────────────────────────────────────────────────────────────

describe("G9 — Batch routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("11. POST /batches — 201 creates batch (operator)", async () => {
    vi.mocked((await import("../batch/runner.js")).createBatch)
      .mockResolvedValueOnce(BATCH_ID);

    const app = await buildRouteApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/batches`)
      .send({ skillType: SKILL_TYPE, items: ITEMS });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.batchRunId).toBe(BATCH_ID);
    expect(res.body.itemCount).toBe(ITEMS.length);
  });

  it("12. POST /batches — 403 for viewer", async () => {
    const app = await buildRouteApp("viewer");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/batches`)
      .send({ skillType: SKILL_TYPE, items: ITEMS });
    expect(res.status).toBe(403);
  });

  it("13. GET /batches/:batchId — 200 returns batch status", async () => {
    vi.mocked((await import("../batch/runner.js")).getBatchStatus)
      .mockResolvedValueOnce(BATCH_STATUS);

    const app = await buildRouteApp();
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/batches/${BATCH_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(BATCH_ID);
    expect(res.body.status).toBe("awaiting_approval");
    expect(res.body.itemCount).toBe(2);
    expect(res.body.completedCount).toBe(2);
  });

  it("14. POST /batches/:batchId/approve — 200 approves batch", async () => {
    vi.mocked((await import("../batch/runner.js")).approveBatch)
      .mockResolvedValueOnce(undefined);

    const app = await buildRouteApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/batches/${BATCH_ID}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe("approved");
  });

  it("15. POST /batches/:batchId/reject — 200 rejects batch", async () => {
    vi.mocked((await import("../batch/runner.js")).rejectBatch)
      .mockResolvedValueOnce(undefined);

    const app = await buildRouteApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/batches/${BATCH_ID}/reject`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe("rejected");
  });
});
