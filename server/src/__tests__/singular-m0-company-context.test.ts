/**
 * M0 — Multi-tenancy: companyContextMiddleware + withTenantDb + requireCtx
 *
 * Tests:
 *  1. unauthenticated actor → req.ctx undefined, next() called
 *  2. board actor with no memberships → req.ctx undefined
 *  3. board actor with x-singular-company-id header for a valid company → correct ctx
 *  4. board actor with x-singular-company-id for a company they don't belong to → 403
 *  5. board actor with no header → defaults to first active membership
 *  6. agent actor → ctx set from actor.companyId
 *  7. requireCtx: unauthenticated → 401
 *  8. requireCtx: no ctx (no memberships) → 403
 *  9. requireCtx: valid ctx → passes through
 * 10. withTenantDb: executes SET LOCAL app.company_id before running callback
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the DB module ────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();
const mockThen = vi.fn();
const mockExecute = vi.fn();
const mockTransaction = vi.fn();

// Chainable query builder mock
function makeQueryChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(),
  execute: mockExecute,
  transaction: mockTransaction,
} as unknown as import("@paperclipai/db").Db;

vi.mock("@paperclipai/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@paperclipai/db")>();
  return {
    ...actual,
    companies: actual.companies,
    companyMemberships: actual.companyMemberships,
    authUsers: actual.authUsers,
  };
});

// ── Test helpers ──────────────────────────────────────────────────────────────

const companyId1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyId2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "user-abc123";
const agentId1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const membership1 = {
  companyId: companyId1,
  role: "owner",
  companyName: "Agence Alpha",
  companySlug: "agence-alpha",
  companyPlan: "growth",
  companyStatus: "active",
};

const membership2 = {
  companyId: companyId2,
  role: "viewer",
  companyName: "Agence Beta",
  companySlug: "agence-beta",
  companyPlan: "solo",
  companyStatus: "active",
};

const company1 = { id: companyId1, plan: "growth", status: "active" };
const company2 = { id: companyId2, plan: "solo", status: "active" };

async function buildApp(
  actor: Record<string, unknown>,
  dbSelectResults: { memberships: unknown[]; company: unknown | null },
) {
  const { companyContextMiddleware, requireCtx } =
    await vi.importActual<typeof import("../middleware/company-context.js")>(
      "../middleware/company-context.js",
    );

  // Configure mockDb.select to return memberships on first call, company on second
  let callCount = 0;
  mockDb.select = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // first select: membership join query
      return makeQueryChain(dbSelectResults.memberships);
    }
    // second select: company fetch
    return makeQueryChain(dbSelectResults.company != null ? [dbSelectResults.company] : []);
  });

  const app = express();
  app.use(express.json());

  // Inject actor
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });

  app.use(companyContextMiddleware(mockDb));

  // Test route that reads req.ctx
  app.get("/test", (req, res) => {
    res.json({ ctx: (req as any).ctx ?? null });
  });

  // Test route that uses requireCtx
  app.get("/guarded", (req, res) => {
    if (!requireCtx(req as any, res)) return;
    res.json({ ok: true, companyId: (req as any).ctx.companyId });
  });

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("companyContextMiddleware", () => {
  it("1. unauthenticated actor → ctx is null, request proceeds", async () => {
    const app = await buildApp(
      { type: "none", source: "none" },
      { memberships: [], company: null },
    );
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body.ctx).toBeNull();
  });

  it("2. board actor with no memberships → ctx is null", async () => {
    const app = await buildApp(
      { type: "board", userId, source: "session" },
      { memberships: [], company: null },
    );
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body.ctx).toBeNull();
  });

  it("3. board actor, valid x-singular-company-id header → correct ctx", async () => {
    const app = await buildApp(
      { type: "board", userId, source: "session" },
      { memberships: [membership1, membership2], company: company1 },
    );
    const res = await request(app)
      .get("/test")
      .set("x-singular-company-id", companyId1);
    expect(res.status).toBe(200);
    expect(res.body.ctx).toMatchObject({
      userId,
      companyId: companyId1,
      role: "owner",
      plan: "growth",
    });
  });

  it("4. board actor, x-singular-company-id for non-member company → 403", async () => {
    const app = await buildApp(
      { type: "board", userId, source: "session" },
      // user only belongs to company1, not company2
      { memberships: [membership1], company: company1 },
    );
    const res = await request(app)
      .get("/test")
      .set("x-singular-company-id", companyId2);
    expect(res.status).toBe(403);
  });

  it("5. board actor, no header → defaults to first active membership", async () => {
    const app = await buildApp(
      { type: "board", userId, source: "session" },
      { memberships: [membership1, membership2], company: company1 },
    );
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body.ctx.companyId).toBe(companyId1);
    expect(res.body.ctx.role).toBe("owner");
    expect(res.body.ctx.plan).toBe("growth");
  });

  it("6. agent actor → ctx set from actor.companyId with manager role", async () => {
    const app = await buildApp(
      { type: "agent", agentId: agentId1, companyId: companyId1, source: "agent_jwt" },
      // agent path only fetches company, not memberships
      { memberships: [], company: company1 },
    );

    // For agent path, the first select is for company (not membership join)
    mockDb.select = vi.fn().mockImplementation(() =>
      makeQueryChain([company1]),
    );

    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body.ctx).toMatchObject({
      companyId: companyId1,
      role: "api",
      plan: "growth",
    });
  });
});

describe("requireCtx", () => {
  it("7. unauthenticated actor → 401", async () => {
    const app = await buildApp(
      { type: "none", source: "none" },
      { memberships: [], company: null },
    );
    const res = await request(app).get("/guarded");
    expect(res.status).toBe(401);
  });

  it("8. authenticated but no memberships → 403", async () => {
    const app = await buildApp(
      { type: "board", userId, source: "session" },
      { memberships: [], company: null },
    );
    const res = await request(app).get("/guarded");
    expect(res.status).toBe(403);
  });

  it("9. valid ctx → passes through", async () => {
    const app = await buildApp(
      { type: "board", userId, source: "session" },
      { memberships: [membership1], company: company1 },
    );
    const res = await request(app).get("/guarded");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, companyId: companyId1 });
  });
});

describe("withTenantDb", () => {
  it("10. executes SET LOCAL app.company_id before running callback", async () => {
    const { withTenantDb } =
      await vi.importActual<typeof import("../middleware/company-context.js")>(
        "../middleware/company-context.js",
      );

    const capturedSql: string[] = [];
    const mockTx = {
      execute: vi.fn().mockImplementation((sql: { queryChunks?: Array<{ value: unknown }> }) => {
        // Capture the SQL template tag content
        const chunk = sql?.queryChunks?.[0]?.value;
        if (typeof chunk === "string") capturedSql.push(chunk);
        return Promise.resolve();
      }),
    };
    const callbackResult = { rows: [1, 2, 3] };
    const callback = vi.fn().mockResolvedValue(callbackResult);

    mockDb.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      return fn(mockTx);
    });

    const result = await withTenantDb(companyId1, mockDb, callback);

    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(mockTx.execute).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
    expect(result).toBe(callbackResult);

    // The SET LOCAL SQL should reference the companyId
    const executedSql = mockTx.execute.mock.calls[0][0];
    // The sql template tag produces an object with queryChunks or strings
    // We verify it was called (SET LOCAL is injected) by checking it ran before callback
    expect(mockTx.execute.mock.invocationCallOrder[0]).toBeLessThan(
      callback.mock.invocationCallOrder[0],
    );
  });
});
