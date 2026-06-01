/**
 * G15 — Plugin/extension system: route tests (tests 11–18)
 *
 * Service unit tests (1–10) are in singular-gap-g15-extensions.test.ts
 *
 * Tests:
 * 11.  POST /companies/:companyId/action-types — 201 registers action type (operator)
 * 12.  POST /companies/:companyId/action-types — 400 missing slug
 * 13.  POST /companies/:companyId/action-types — 400 invalid slug format
 * 14.  GET  /companies/:companyId/action-types — 200 lists action types
 * 15.  DELETE /companies/:companyId/action-types/:id — 200 deactivates
 * 16.  DELETE /companies/:companyId/action-types/:id — 404 not found
 * 17.  POST /companies/:companyId/action-types/:id/invoke — 200 invokes webhook
 * 18.  POST /companies/:companyId/action-types/:id/invoke — 404 not found
 */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  registeredActionTypes: {
    id: "id", companyId: "companyId", slug: "slug", name: "name",
    description: "description", inputSchema: "inputSchema", outputSchema: "outputSchema",
    webhookUrl: "webhookUrl", webhookSecret: "webhookSecret",
    isActive: "isActive", createdByUserId: "createdByUserId", createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq:  (...a: any[]) => ({ op: "eq",  a }),
  and: (...a: any[]) => ({ op: "and", a }),
}));

vi.mock("../extensions/action-type-registry.js", () => ({
  registerActionType:  vi.fn(),
  listActionTypes:     vi.fn(),
  getActionType:       vi.fn(),
  deactivateActionType: vi.fn(),
  invokeActionType:    vi.fn(),
  signPayload:         vi.fn(),
  generateWebhookSecret: vi.fn().mockReturnValue("secret"),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AT_ID      = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const MOCK_AT = {
  id: AT_ID, companyId: COMPANY_ID, slug: "send-sms",
  name: "Send SMS", description: null,
  inputSchema: {}, outputSchema: {},
  webhookUrl: "https://example.com/hook",
  isActive: true, createdAt: new Date().toISOString(),
};

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp(role: "operator" | "viewer" = "operator") {
  const { extensionRoutes } = await import("../routes/extensions.js");
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
  app.use("/", extensionRoutes({} as any));
  app.use(errorHandler);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("G15 — Extension routes", () => {

  async function getService() {
    return import("../extensions/action-type-registry.js");
  }

  it("11. POST /companies/:companyId/action-types — 201 registers action type", async () => {
    const { registerActionType } = await getService();
    vi.mocked(registerActionType).mockResolvedValueOnce(MOCK_AT as any);
    const app = await buildApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/action-types`)
      .send({ slug: "send-sms", name: "Send SMS", webhookUrl: "https://example.com/hook" });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.actionType.slug).toBe("send-sms");
  });

  it("12. POST /companies/:companyId/action-types — 400 missing slug", async () => {
    const app = await buildApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/action-types`)
      .send({ name: "Send SMS", webhookUrl: "https://example.com/hook" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/slug/i);
  });

  it("13. POST /companies/:companyId/action-types — 400 invalid slug format", async () => {
    const app = await buildApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/action-types`)
      .send({ slug: "INVALID SLUG!", name: "X", webhookUrl: "https://example.com/hook" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/slug/i);
  });

  it("14. GET /companies/:companyId/action-types — 200 lists action types", async () => {
    const { listActionTypes } = await getService();
    vi.mocked(listActionTypes).mockResolvedValueOnce([MOCK_AT] as any);
    const app = await buildApp("operator");
    const res = await request(app).get(`/companies/${COMPANY_ID}/action-types`);
    expect(res.status).toBe(200);
    expect(res.body.actionTypes).toHaveLength(1);
    expect(res.body.actionTypes[0].slug).toBe("send-sms");
  });

  it("15. DELETE /companies/:companyId/action-types/:id — 200 deactivates", async () => {
    const { deactivateActionType } = await getService();
    vi.mocked(deactivateActionType).mockResolvedValueOnce({ id: AT_ID });
    const app = await buildApp("operator");
    const res = await request(app)
      .delete(`/companies/${COMPANY_ID}/action-types/${AT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBe(AT_ID);
  });

  it("16. DELETE /companies/:companyId/action-types/:id — 404 not found", async () => {
    const { deactivateActionType } = await getService();
    vi.mocked(deactivateActionType).mockResolvedValueOnce(null);
    const app = await buildApp("operator");
    const res = await request(app)
      .delete(`/companies/${COMPANY_ID}/action-types/${AT_ID}`);
    expect(res.status).toBe(404);
  });

  it("17. POST /companies/:companyId/action-types/:id/invoke — 200 invokes webhook", async () => {
    const { invokeActionType } = await getService();
    vi.mocked(invokeActionType).mockResolvedValueOnce({ ok: true, status: 200, data: { result: "sent" } });
    const app = await buildApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/action-types/${AT_ID}/invoke`)
      .send({ input: { phone: "+33612345678" } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual({ result: "sent" });
  });

  it("18. POST /companies/:companyId/action-types/:id/invoke — 404 not found", async () => {
    const { invokeActionType } = await getService();
    vi.mocked(invokeActionType).mockRejectedValueOnce(new Error("Action type not found"));
    const app = await buildApp("operator");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/action-types/${AT_ID}/invoke`)
      .send({});
    expect(res.status).toBe(404);
  });
});
