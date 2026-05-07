/**
 * Gap C — Swwarm admin portal
 *
 * Tests:
 *  1. GET /admin/health — 200 with tenants, tasksAllTime, costLast30Days
 *  2. GET /admin/health — rejects non-instance-admin (403)
 *  3. GET /admin/tenants — 200 list with health metrics
 *  4. GET /admin/tenants — rejects non-instance-admin (403)
 *  5. GET /admin/tenants/:id — 200 with company + members + agents + audit
 *  6. GET /admin/tenants/:id — 404 when company not found
 *  7. GET /admin/tenants/:id — rejects non-instance-admin (403)
 *  8. POST /admin/tenants/:id/impersonate — 200 with session data
 *  9. POST /admin/tenants/:id/impersonate — writes audit entry
 * 10. POST /admin/tenants/:id/impersonate — 404 when company not found
 * 11. DELETE /admin/tenants/:id/impersonate — 200 with ok:true
 * 12. DELETE /admin/tenants/:id/impersonate — writes audit entry
 * 13. GET /admin/health — costLast30Days is in euros (not micro-euros)
 * 14. GET /admin/tenants — costLast30d is in euros per tenant
 * 15. GET /admin/tenants/:id — costLast30d is in euros
 */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────

const COMPANY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ADMIN_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// ── Mock DB factory ───────────────────────────────────────────────────────────

const DEFAULT_COMPANY = {
  id: COMPANY_ID, name: "Acme", slug: "acme", plan: "growth", status: "active",
  createdAt: new Date(), stripeCustomerId: null, stripeSubId: null,
  tasksUsedMonth: 10, tasksLimitMonth: 2000, tokensUsedMonth: 100_000,
  tokensLimitMonth: 20_000_000, spentMonthlyCents: 0, budgetMonthlyCents: 0,
  locale: "fr", timezone: "Europe/Paris",
};

/**
 * Builds a DB mock where each .select() call pops the next response from a queue.
 * Terminal methods (where, groupBy, orderBy, limit) resolve with the current response.
 * where() is special: it returns a chainable thenable so .where().orderBy() works.
 */
function makeDb(responses: unknown[][], insertResolve: unknown = [{ id: "audit-1" }]) {
  const queue = [...responses];

  function makeChain() {
    let current: unknown[] = [];

    const chain: any = {};

    function thenable() {
      const snap = current;
      return {
        ...chain,
        then: (resolve: any, reject: any) => Promise.resolve(snap).then(resolve, reject),
      };
    }

    chain.select = vi.fn().mockImplementation(() => {
      current = (queue.shift() ?? []) as unknown[];
      return chain;
    });

    // Every method returns a thenable so it can be either awaited or chained further.
    for (const m of ["from", "leftJoin", "innerJoin", "where", "orderBy", "groupBy"]) {
      chain[m] = vi.fn().mockImplementation(thenable);
    }

    chain.limit = vi.fn().mockImplementation(() => Promise.resolve(current));

    chain.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(insertResolve),
      }),
    });

    return chain;
  }

  return makeChain();
}

// ── Response builders ─────────────────────────────────────────────────────────

/** Responses for GET /admin/health (3 queries) */
function healthResponses(costMicro = 5_000_000) {
  return [
    [DEFAULT_COMPANY],           // tenantCount
    [{ count: 42 }],             // taskCount
    [{ total: costMicro }],      // costRow
  ];
}

/** Responses for GET /admin/tenants (5 queries) */
function tenantsResponses(costMicro = 2_000_000) {
  return [
    [DEFAULT_COMPANY],                                    // allCompanies
    [{ companyId: COMPANY_ID, count: 3 }],               // memberCounts
    [{ companyId: COMPANY_ID, count: 2 }],               // agentCounts
    [{ companyId: COMPANY_ID, count: 10 }],              // recentTasks
    [{ companyId: COMPANY_ID, total: costMicro }],       // recentCosts
  ];
}

/** Responses for GET /admin/tenants/:id (6 queries) */
function tenantDetailResponses(costMicro = 3_000_000) {
  return [
    [DEFAULT_COMPANY],                                   // company
    [{ userId: "u1", role: "owner", status: "active", email: "ceo@acme.fr", name: "Alice", joinedAt: new Date() }], // members
    [{ id: "ag1", name: "Sophie", status: "active", role: "sourcing" }],  // agents
    [],                                                  // recentAudit
    [{ count: 15 }],                                    // taskRow
    [{ total: costMicro }],                             // costRow
  ];
}

/** Responses for impersonate POST (1 query: company lookup) */
function impersonateResponses() {
  return [[DEFAULT_COMPANY]];
}

/** Empty company responses (for 404 tests) */
function notFoundResponses() {
  return [[]];
}

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp(isAdmin: boolean, responses: unknown[][] = [], insertResolve?: unknown) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: ADMIN_USER_ID,
      companyIds: [COMPANY_ID],
      source: isAdmin ? "local_implicit" : "jwt",
      isInstanceAdmin: isAdmin,
    };
    next();
  });

  const db = makeDb(responses, insertResolve);
  const { adminRoutes } = await import("../routes/admin.js");
  const router = adminRoutes(db as any);
  app.use("/api/v1", router);
  app.use(errorHandler);
  return { app, db };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Gap C — admin portal routes", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Health ────────────────────────────────────────────────────────────────

  it("1. GET /admin/health — 200 with platform aggregate", async () => {
    const { app } = await buildApp(true, healthResponses());
    const res = await request(app).get("/api/v1/admin/health");
    expect(res.status).toBe(200);
    expect(typeof res.body.tenants).toBe("number");
    expect(typeof res.body.tasksAllTime).toBe("number");
    expect(typeof res.body.costLast30Days).toBe("number");
  });

  it("2. GET /admin/health — 403 for non-instance-admin", async () => {
    const { app } = await buildApp(false, []);
    const res = await request(app).get("/api/v1/admin/health");
    expect(res.status).toBe(403);
  });

  it("13. GET /admin/health — costLast30Days is in euros (5_000_000 micro → 5)", async () => {
    const { app } = await buildApp(true, healthResponses(5_000_000));
    const res = await request(app).get("/api/v1/admin/health");
    expect(res.status).toBe(200);
    expect(res.body.costLast30Days).toBe(5);
  });

  // ── Tenant list ───────────────────────────────────────────────────────────

  it("3. GET /admin/tenants — 200 list with health metrics", async () => {
    const { app } = await buildApp(true, tenantsResponses());
    const res = await request(app).get("/api/v1/admin/tenants");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tenants)).toBe(true);
    const t = res.body.tenants[0];
    expect(t).toHaveProperty("id");
    expect(t).toHaveProperty("members");
    expect(t).toHaveProperty("activeAgents");
    expect(t).toHaveProperty("tasksLast30d");
    expect(t).toHaveProperty("costLast30d");
  });

  it("4. GET /admin/tenants — 403 for non-instance-admin", async () => {
    const { app } = await buildApp(false, []);
    const res = await request(app).get("/api/v1/admin/tenants");
    expect(res.status).toBe(403);
  });

  it("14. GET /admin/tenants — costLast30d is in euros per tenant", async () => {
    const { app } = await buildApp(true, tenantsResponses(2_000_000));
    const res = await request(app).get("/api/v1/admin/tenants");
    expect(res.status).toBe(200);
    const t = res.body.tenants.find((x: any) => x.id === COMPANY_ID);
    expect(t?.costLast30d).toBe(2);
  });

  // ── Single tenant ─────────────────────────────────────────────────────────

  it("5. GET /admin/tenants/:id — 200 with company detail", async () => {
    const { app } = await buildApp(true, tenantDetailResponses());
    const res = await request(app).get(`/api/v1/admin/tenants/${COMPANY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.company).toHaveProperty("id");
    expect(Array.isArray(res.body.members)).toBe(true);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(Array.isArray(res.body.recentAudit)).toBe(true);
    expect(typeof res.body.tasksLast30d).toBe("number");
    expect(typeof res.body.costLast30d).toBe("number");
  });

  it("6. GET /admin/tenants/:id — 404 when company not found", async () => {
    const { app } = await buildApp(true, notFoundResponses());
    const res = await request(app).get(`/api/v1/admin/tenants/${COMPANY_ID}`);
    expect(res.status).toBe(404);
  });

  it("7. GET /admin/tenants/:id — 403 for non-instance-admin", async () => {
    const { app } = await buildApp(false, []);
    const res = await request(app).get(`/api/v1/admin/tenants/${COMPANY_ID}`);
    expect(res.status).toBe(403);
  });

  it("15. GET /admin/tenants/:id — costLast30d is in euros", async () => {
    const { app } = await buildApp(true, tenantDetailResponses(3_000_000));
    const res = await request(app).get(`/api/v1/admin/tenants/${COMPANY_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.costLast30d).toBe(3);
  });

  // ── Impersonation ─────────────────────────────────────────────────────────

  it("8. POST /admin/tenants/:id/impersonate — 200 with session data", async () => {
    const { app } = await buildApp(true, impersonateResponses());
    const res = await request(app).post(`/api/v1/admin/tenants/${COMPANY_ID}/impersonate`);
    expect(res.status).toBe(200);
    expect(res.body.companyId).toBe(COMPANY_ID);
    expect(res.body.companyName).toBeDefined();
    expect(res.body.impersonatorId).toBe(ADMIN_USER_ID);
    expect(res.body.startedAt).toBeDefined();
  });

  it("9. POST /admin/tenants/:id/impersonate — writes audit entry", async () => {
    const { app, db } = await buildApp(true, impersonateResponses());
    await request(app).post(`/api/v1/admin/tenants/${COMPANY_ID}/impersonate`);
    expect(db.insert).toHaveBeenCalled();
  });

  it("10. POST /admin/tenants/:id/impersonate — 404 when company not found", async () => {
    const { app } = await buildApp(true, notFoundResponses());
    const res = await request(app).post(`/api/v1/admin/tenants/${COMPANY_ID}/impersonate`);
    expect(res.status).toBe(404);
  });

  it("11. DELETE /admin/tenants/:id/impersonate — 200 with ok:true", async () => {
    const { app } = await buildApp(true, []);
    const res = await request(app).delete(`/api/v1/admin/tenants/${COMPANY_ID}/impersonate`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("12. DELETE /admin/tenants/:id/impersonate — writes audit entry", async () => {
    const { app, db } = await buildApp(true, []);
    await request(app).delete(`/api/v1/admin/tenants/${COMPANY_ID}/impersonate`);
    expect(db.insert).toHaveBeenCalled();
  });
});
