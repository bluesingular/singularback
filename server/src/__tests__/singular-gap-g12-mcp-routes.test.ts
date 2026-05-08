/**
 * G12 — MCP Server route tests (tests 13–16)
 *
 * Service unit tests (1–12) are in singular-gap-g12-mcp.test.ts
 *
 * Tests:
 * 13.  POST /mcp/:companyId — 200 with valid API key (initialize)
 * 14.  POST /mcp/:companyId — 401 when Authorization header missing
 * 15.  POST /mcp/:companyId — 401 when key not found in db
 * 16.  POST /companies/:companyId/mcp/keys — 201 creates key (operator)
 * 17.  POST /companies/:companyId/mcp/keys — 403 for viewer
 * 18.  DELETE /companies/:companyId/mcp/keys/:keyId — 200 revokes key
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";
import { createHash } from "node:crypto";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  mcpApiKeys: {
    id: "id", companyId: "companyId", keyHash: "keyHash",
    revokedAt: "revokedAt", lastUsedAt: "lastUsedAt",
    name: "name", createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq:     (...a: any[]) => ({ op: "eq",     a }),
  and:    (...a: any[]) => ({ op: "and",    a }),
  isNull: (...a: any[]) => ({ op: "isNull", a }),
}));

vi.mock("../mcp/server.js", () => ({
  handleJsonRpc: vi.fn().mockResolvedValue({
    jsonrpc: "2.0", id: 1,
    result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "swwarm", version: "1.0.0" } },
  }),
  MCP_PROTOCOL_VERSION: "2024-11-05",
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY_ID     = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RAW_KEY    = "swm_testkey123";

// ── App builders ──────────────────────────────────────────────────────────────

async function buildMcpApp(dbOverride?: any) {
  const { mcpServerRoutes } = await import("../routes/mcp-server.js");
  const app = express();
  app.use(express.json());
  app.use("/", mcpServerRoutes(dbOverride ?? ({} as any)));
  app.use(errorHandler);
  return app;
}

async function buildAuthApp(role: "operator" | "viewer" = "operator", dbOverride?: any) {
  const { mcpServerRoutes } = await import("../routes/mcp-server.js");
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
  app.use("/", mcpServerRoutes(dbOverride ?? ({} as any)));
  app.use(errorHandler);
  return app;
}

// ── Route tests ───────────────────────────────────────────────────────────────

describe("G12 — MCP server routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("13. POST /mcp/:companyId — 200 with valid API key", async () => {
    const keyHash = createHash("sha256").update(RAW_KEY).digest("hex");
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: KEY_ID, companyId: COMPANY_ID }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
    };

    const app = await buildMcpApp(db);
    const res = await request(app)
      .post(`/mcp/${COMPANY_ID}`)
      .set("Authorization", `Bearer ${RAW_KEY}`)
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.protocolVersion).toBe("2024-11-05");
  });

  it("14. POST /mcp/:companyId — 401 when Authorization header missing", async () => {
    const app = await buildMcpApp();
    const res = await request(app)
      .post(`/mcp/${COMPANY_ID}`)
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(res.status).toBe(401);
  });

  it("15. POST /mcp/:companyId — 401 when key not found in db", async () => {
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // no matching key
        }),
      }),
    };
    const app = await buildMcpApp(db);
    const res = await request(app)
      .post(`/mcp/${COMPANY_ID}`)
      .set("Authorization", "Bearer invalid-key")
      .send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(res.status).toBe(401);
  });

  it("16. POST /companies/:companyId/mcp/keys — 201 creates key (operator)", async () => {
    const db: any = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: KEY_ID, name: "Claude integration", createdAt: new Date() }]),
        }),
      }),
    };
    const app = await buildAuthApp("operator", db);
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/mcp/keys`)
      .send({ name: "Claude integration" });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.key).toMatch(/^swm_/);
    expect(res.body.id).toBe(KEY_ID);
  });

  it("17. POST /companies/:companyId/mcp/keys — 403 for viewer", async () => {
    const app = await buildAuthApp("viewer");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/mcp/keys`)
      .send({ name: "test" });
    expect(res.status).toBe(403);
  });

  it("18. DELETE /companies/:companyId/mcp/keys/:keyId — 200 revokes key", async () => {
    const db: any = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: KEY_ID }]),
          }),
        }),
      }),
    };
    const app = await buildAuthApp("operator", db);
    const res = await request(app)
      .delete(`/companies/${COMPANY_ID}/mcp/keys/${KEY_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBe(KEY_ID);
  });
});
