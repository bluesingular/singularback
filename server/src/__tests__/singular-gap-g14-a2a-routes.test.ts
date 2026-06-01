/**
 * G14 — A2A protocol route tests (tests 11–18)
 *
 * Server unit tests (1–10) are in singular-gap-g14-a2a.test.ts
 *
 * Tests:
 * 11.  GET /.well-known/agent.json — 200 without auth, valid agent card
 * 12.  GET /a2a/:companyId/agent.json — 200 returns company-specific card
 * 13.  POST /a2a/:companyId — 200 tasks/send with valid Bearer key
 * 14.  POST /a2a/:companyId — 401 without Authorization header
 * 15.  POST /a2a/:companyId — 403 when key belongs to different company
 * 16.  POST /a2a/:companyId — 200 tasks/get returns task
 * 17.  POST /a2a/:companyId — 200 tasks/cancel returns canceled state
 * 18.  POST /a2a/:companyId — METHOD_NOT_FOUND for unknown method
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  agents: { id: "id", companyId: "companyId", name: "name", status: "status" },
  issues: {
    id: "id", companyId: "companyId", title: "title",
    description: "description", status: "status",
    createdAt: "createdAt", originKind: "originKind", originId: "originId",
  },
  publicApiKeys: {
    id: "id", companyId: "companyId", keyHash: "keyHash",
    scope: "scope", rateLimitPerHour: "rateLimitPerHour",
    lastUsedAt: "lastUsedAt", revokedAt: "revokedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq:   (...a: any[]) => ({ op: "eq",   a }),
  and:  (...a: any[]) => ({ op: "and",  a }),
  isNull: (...a: any[]) => ({ op: "isNull", a }),
}));

vi.mock("../a2a/server.js", () => ({
  A2A_PROTOCOL_VERSION: "1.0",
  buildAgentCard: vi.fn().mockImplementation(async (_db: any, companyId: string, baseUrl: string) => ({
    name: "Swwarm AI Platform",
    url: `${baseUrl}/a2a/${companyId}`,
    version: "1.0",
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    authentication: { schemes: ["Bearer"] },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [{ id: "agent-1", name: "Sophie" }],
  })),
  handleA2ARequest: vi.fn().mockImplementation(async (_db, _companyId, body: any) => {
    const method = body?.method;
    if (method === "tasks/send") {
      return {
        jsonrpc: "2.0", id: body.id,
        result: { id: "task-1", status: { state: "submitted", timestamp: new Date().toISOString() } },
      };
    }
    if (method === "tasks/get") {
      return {
        jsonrpc: "2.0", id: body.id,
        result: { id: "task-1", status: { state: "working", timestamp: new Date().toISOString() } },
      };
    }
    if (method === "tasks/cancel") {
      return {
        jsonrpc: "2.0", id: body.id,
        result: { id: "task-1", status: { state: "canceled", timestamp: new Date().toISOString() } },
      };
    }
    return {
      jsonrpc: "2.0", id: body.id,
      error: { code: -32601, message: "Method not found" },
    };
  }),
}));

vi.mock("../middleware/public-api-auth.js", () => ({
  publicApiAuth: (_db: any) => (req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing Authorization: Bearer <api-key>" });
      return;
    }
    const token = authHeader.slice(7).trim();
    if (token === "valid-key") {
      req.publicApiCompanyId = COMPANY_ID;
      req.publicApiKeyId     = "key-1";
      req.publicApiScope     = "read_write";
    } else if (token === "other-company-key") {
      req.publicApiCompanyId = "other-company-id";
      req.publicApiKeyId     = "key-2";
      req.publicApiScope     = "read_write";
    } else {
      res.status(401).json({ error: "Invalid or revoked API key" });
      return;
    }
    next();
  },
  hashApiKey: (raw: string) => `hash:${raw}`,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp(dbOverride?: any) {
  const { a2aRoutes } = await import("../routes/a2a.js");
  const app = express();
  app.use(express.json());
  app.use("/", a2aRoutes(dbOverride ?? ({} as any)));
  app.use(errorHandler);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("G14 — A2A routes", () => {

  it("11. GET /.well-known/agent.json — 200 without auth", async () => {
    const app = await buildApp();
    const res = await request(app).get("/.well-known/agent.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Swwarm AI Platform");
    expect(res.body.capabilities.streaming).toBe(false);
    expect(res.body.capabilities.stateTransitionHistory).toBe(true);
    expect(res.body.authentication.schemes).toContain("Bearer");
  });

  it("12. GET /a2a/:companyId/agent.json — 200 returns company-specific card", async () => {
    const app = await buildApp();
    const res = await request(app).get(`/a2a/${COMPANY_ID}/agent.json`);
    expect(res.status).toBe(200);
    expect(res.body.url).toContain(COMPANY_ID);
    expect(res.body.skills).toBeDefined();
  });

  it("13. POST /a2a/:companyId — 200 tasks/send with valid key", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/a2a/${COMPANY_ID}`)
      .set("Authorization", "Bearer valid-key")
      .send({
        jsonrpc: "2.0", id: 1, method: "tasks/send",
        params: {
          id: "task-1",
          message: { role: "user", parts: [{ type: "text", text: "Qualify this CV" }] },
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result?.status?.state).toBe("submitted");
    expect(res.body.error).toBeUndefined();
  });

  it("14. POST /a2a/:companyId — 401 without Authorization header", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/a2a/${COMPANY_ID}`)
      .send({ jsonrpc: "2.0", id: 1, method: "tasks/send", params: {} });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  it("15. POST /a2a/:companyId — 403 when key belongs to different company", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/a2a/${COMPANY_ID}`)
      .set("Authorization", "Bearer other-company-key")
      .send({ jsonrpc: "2.0", id: 1, method: "tasks/send", params: {} });
    expect(res.status).toBe(403);
  });

  it("16. POST /a2a/:companyId — 200 tasks/get returns task", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/a2a/${COMPANY_ID}`)
      .set("Authorization", "Bearer valid-key")
      .send({ jsonrpc: "2.0", id: 2, method: "tasks/get", params: { id: "task-1" } });
    expect(res.status).toBe(200);
    expect(res.body.result?.status?.state).toBe("working");
  });

  it("17. POST /a2a/:companyId — 200 tasks/cancel returns canceled state", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/a2a/${COMPANY_ID}`)
      .set("Authorization", "Bearer valid-key")
      .send({ jsonrpc: "2.0", id: 3, method: "tasks/cancel", params: { id: "task-1" } });
    expect(res.status).toBe(200);
    expect(res.body.result?.status?.state).toBe("canceled");
  });

  it("18. POST /a2a/:companyId — METHOD_NOT_FOUND for unknown method", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post(`/a2a/${COMPANY_ID}`)
      .set("Authorization", "Bearer valid-key")
      .send({ jsonrpc: "2.0", id: 4, method: "tasks/unknown", params: {} });
    expect(res.status).toBe(200); // A2A always returns 200
    expect(res.body.error?.code).toBe(-32601);
  });
});
