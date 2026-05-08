/**
 * G13 — Public API route tests (tests 11–18)
 *
 * Service/middleware unit tests (1–10) are in singular-gap-g13-public-api.test.ts
 *
 * Tests:
 * 11.  GET /api/v1/openapi.json — 200 without auth
 * 12.  GET /api/v1/agents — 200 with valid key
 * 13.  GET /api/v1/agents — 401 with missing key
 * 14.  GET /api/v1/tasks — 200 with valid key
 * 15.  POST /api/v1/tasks — 201 with read_write key
 * 16.  POST /api/v1/tasks — 403 with read-only key
 * 17.  POST /companies/:companyId/public-api/keys — 201 creates key (operator)
 * 18.  DELETE /companies/:companyId/public-api/keys/:keyId — 200 revokes key
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks (hoisted) ────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  publicApiKeys: {
    id: "id", companyId: "companyId", keyHash: "keyHash",
    scope: "scope", rateLimitPerHour: "rateLimitPerHour",
    lastUsedAt: "lastUsedAt", revokedAt: "revokedAt",
    name: "name", createdAt: "createdAt", createdByUserId: "createdByUserId",
  },
  webhookSubscriptions: {
    id: "id", companyId: "companyId", url: "url", events: "events",
    signingSecret: "signingSecret", active: "active", createdAt: "createdAt",
  },
  agents: {
    id: "id", companyId: "companyId", name: "name",
    description: "description", icon: "icon",
    isActive: "isActive", createdAt: "createdAt",
  },
  issues: {
    id: "id", companyId: "companyId", title: "title",
    status: "status", agentId: "agentId",
    createdAt: "createdAt", updatedAt: "updatedAt",
    description: "description", originKind: "originKind",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq:   (...a: any[]) => ({ op: "eq",   a }),
  and:  (...a: any[]) => ({ op: "and",  a }),
  isNull: (...a: any[]) => ({ op: "isNull", a }),
  desc: (...a: any[]) => ({ op: "desc", a }),
}));

vi.mock("../middleware/public-api-auth.js", () => ({
  publicApiAuth: (db: any) => (req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing Authorization: Bearer <api-key>" });
      return;
    }
    const token = authHeader.slice(7).trim();
    if (token === "read-only-key") {
      req.publicApiCompanyId = COMPANY_ID;
      req.publicApiKeyId     = "key-ro-id";
      req.publicApiScope     = "read";
    } else if (token === "valid-key") {
      req.publicApiCompanyId = COMPANY_ID;
      req.publicApiKeyId     = "key-rw-id";
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
const KEY_ID     = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ── App builders ──────────────────────────────────────────────────────────────

async function buildApp(dbOverride?: any) {
  const { publicApiRoutes } = await import("../routes/public-api.js");
  const app = express();
  app.use(express.json());
  app.use("/", publicApiRoutes(dbOverride ?? ({} as any)));
  app.use(errorHandler);
  return app;
}

async function buildAuthApp(role: "operator" | "viewer" = "operator", dbOverride?: any) {
  const { publicApiRoutes } = await import("../routes/public-api.js");
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
  app.use("/", publicApiRoutes(dbOverride ?? ({} as any)));
  app.use(errorHandler);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("G13 — Public API routes", () => {

  it("11. GET /api/v1/openapi.json — 200 without auth", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.paths).toBeDefined();
  });

  it("12. GET /api/v1/agents — 200 with valid key", async () => {
    const agentRow = { id: "a1", name: "Sophie", isActive: true, createdAt: new Date().toISOString() };
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([agentRow]),
    };
    const app = await buildApp(db);
    const res = await request(app)
      .get("/api/v1/agents")
      .set("Authorization", "Bearer valid-key");
    expect(res.status).toBe(200);
    expect(res.body.agents).toHaveLength(1);
    expect(res.body.agents[0].name).toBe("Sophie");
  });

  it("13. GET /api/v1/agents — 401 with missing key", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/v1/agents");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  it("14. GET /api/v1/tasks — 200 with valid key", async () => {
    const taskRow = { id: "t1", title: "Qualify CV", status: "open", agentId: "a1", createdAt: new Date().toISOString() };
    const db: any = {
      select: vi.fn().mockReturnThis(),
      from:   vi.fn().mockReturnThis(),
      where:  vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([taskRow]),
    };
    const app = await buildApp(db);
    const res = await request(app)
      .get("/api/v1/tasks")
      .set("Authorization", "Bearer valid-key");
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe("Qualify CV");
    expect(res.body.total).toBe(1);
  });

  it("15. POST /api/v1/tasks — 201 with read_write key", async () => {
    const taskRow = {
      id: "t-new", title: "New task", status: "open",
      agentId: null, createdAt: new Date().toISOString(), updatedAt: null,
    };
    const mockReturning = vi.fn().mockResolvedValue([taskRow]);
    const mockValues    = vi.fn().mockReturnValue({ returning: mockReturning });
    const db: any = {
      insert: vi.fn().mockReturnValue({ values: mockValues }),
    };
    const app = await buildApp(db);
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", "Bearer valid-key")
      .send({ title: "New task" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("New task");
  });

  it("16. POST /api/v1/tasks — 403 with read-only key", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", "Bearer read-only-key")
      .send({ title: "Should fail" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/read-only/i);
  });

  it("17. POST /companies/:companyId/public-api/keys — 201 creates key (operator)", async () => {
    const keyRow = { id: KEY_ID, name: "Integration Key", scope: "read_write", createdAt: new Date().toISOString() };
    const mockReturning = vi.fn().mockResolvedValue([keyRow]);
    const mockValues    = vi.fn().mockReturnValue({ returning: mockReturning });
    const db: any = {
      insert: vi.fn().mockReturnValue({ values: mockValues }),
    };
    const app = await buildAuthApp("operator", db);
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/public-api/keys`)
      .send({ name: "Integration Key", scope: "read_write" });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.key).toMatch(/^spk_/);
    expect(res.body.scope).toBe("read_write");
  });

  it("18. DELETE /companies/:companyId/public-api/keys/:keyId — 200 revokes key", async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: KEY_ID }]);
    const mockWhere     = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet       = vi.fn().mockReturnValue({ where: mockWhere });
    const db: any = {
      update: vi.fn().mockReturnValue({ set: mockSet }),
    };
    const app = await buildAuthApp("operator", db);
    const res = await request(app)
      .delete(`/companies/${COMPANY_ID}/public-api/keys/${KEY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBe(KEY_ID);
  });
});
