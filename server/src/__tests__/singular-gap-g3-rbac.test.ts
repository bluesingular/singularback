/**
 * G3 — RBAC (Owner/Admin/Operator/Viewer roles)
 *
 * Tests:
 *  1.  GET  /companies/:id/trust — viewer (role=viewer) is allowed (read-only)
 *  2.  POST /companies/:id/trust/proposals/:pid/approve — viewer gets 403
 *  3.  POST /companies/:id/trust/proposals/:pid/approve — operator gets through
 *  4.  POST /companies/:id/trust/proposals/:pid/reject — viewer gets 403
 *  5.  PATCH /companies/:id/intelligence-cards/:cid/read — viewer gets 403
 *  6.  PATCH /companies/:id/intelligence-cards/:cid/read — operator gets through
 *  7.  PUT  /companies/:id/agent-config/:agentId — viewer gets 403
 *  8.  PUT  /companies/:id/agent-config/:agentId — operator gets through
 *  9.  GET  /companies/:id/singular/members — returns members list
 * 10.  PATCH /companies/:id/singular/members/:mid/role — viewer gets 403
 * 11.  PATCH /companies/:id/singular/members/:mid/role — admin gets through
 * 12.  PATCH /companies/:id/singular/members/:mid/role — only owner can assign "owner" role
 * 13.  PATCH /companies/:id/singular/members/:mid/role — 409 when demoting last owner
 * 14.  DELETE /companies/:id/singular/members/:mid — viewer gets 403
 * 15.  DELETE /companies/:id/singular/members/:mid — admin removes member (soft-delete)
 * 16.  DELETE /companies/:id/singular/members/:mid — 409 when removing last owner
 */

import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Fixture IDs ────────────────────────────────────────────────────────────────

const COMPANY_ID  = "c0000000-c000-4000-8000-c00000000000";
const USER_ID     = "u0000000-u000-4000-8000-u00000000000";
const MEMBER_ID   = "m0000000-m000-4000-8000-m00000000000";
const PROPOSAL_ID = "p0000000-p000-4000-8000-p00000000000";
const CARD_ID     = "ca000000-ca00-4000-8000-ca0000000000";
const AGENT_ID    = "ag000000-ag00-4000-8000-ag0000000000";

// ── DB mock ────────────────────────────────────────────────────────────────────

function makeDb(responses: unknown[][] = [], updateResolve: unknown = [{ id: MEMBER_ID }]) {
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

    // sql tagged template — returns a sentinel object (drizzle SQL)
    chain.sql = Object.assign(
      (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ __sql: true }),
      { raw: (_s: string) => ({ __sql: true }) },
    );

    for (const m of ["from", "leftJoin", "innerJoin", "where", "orderBy", "groupBy"]) {
      chain[m] = vi.fn().mockImplementation(thenable);
    }

    chain.limit = vi.fn().mockImplementation(() => Promise.resolve(current));

    // update chain: .update().set().where().returning() — all must be chainable
    chain.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(updateResolve),
          then: (resolve: any, reject: any) =>
            Promise.resolve(updateResolve).then(resolve, reject),
        }),
      }),
    });

    chain.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "audit-1" }]),
      }),
    });

    return chain;
  }

  return makeChain();
}

// ── App builders ───────────────────────────────────────────────────────────────

type Role = "owner" | "admin" | "operator" | "viewer";

async function buildTrustApp(role: Role, responses: unknown[][] = []) {
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

  const db = makeDb(responses);
  const { trustRoutes } = await import("../routes/trust.js");
  app.use("/api/v1", trustRoutes(db as any));
  app.use(errorHandler);
  return app;
}

async function buildIntelligenceApp(role: Role, responses: unknown[][] = []) {
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

  const db = makeDb(responses);
  const { intelligenceRoutes } = await import("../routes/intelligence.js");
  app.use("/api/v1", intelligenceRoutes(db as any));
  app.use(errorHandler);
  return app;
}

async function buildAgentConfigApp(role: Role, responses: unknown[][] = []) {
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

  const db = makeDb(responses);
  const { agentConfigRoutes } = await import("../routes/agent-config.js");
  app.use("/api/v1", agentConfigRoutes(db as any));
  app.use(errorHandler);
  return app;
}

async function buildMembersApp(role: Role, responses: unknown[][] = [], updateResolve?: unknown) {
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

  const db = makeDb(responses, updateResolve);
  const { membersRoutes } = await import("../routes/members.js");
  app.use("/api/v1", membersRoutes(db as any));
  app.use(errorHandler);
  return app;
}

// ── Test data ─────────────────────────────────────────────────────────────────

const MEMBER_ROW = {
  id: MEMBER_ID,
  userId: USER_ID,
  role: "operator",
  status: "active",
  joinedAt: new Date(),
  email: "alice@acme.fr",
  name: "Alice",
};

const OWNER_MEMBERSHIP = {
  id: MEMBER_ID,
  companyId: COMPANY_ID,
  principalId: USER_ID,
  principalType: "user",
  membershipRole: "owner",
  status: "active",
};

const OPERATOR_MEMBERSHIP = {
  ...OWNER_MEMBERSHIP,
  membershipRole: "operator",
};

const PROPOSAL_ROW = {
  id: PROPOSAL_ID,
  companyId: COMPANY_ID,
  agentId: AGENT_ID,
  status: "pending",
  proposedLevel: "trusted",
};

const CARD_ROW = {
  id: CARD_ID,
  companyId: COMPANY_ID,
  status: "unread",
  urgency: 1,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("G3 — RBAC", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Trust route role enforcement ───────────────────────────────────────────

  it("1. GET /trust — viewer is allowed (read-only route)", async () => {
    const app = await buildTrustApp("viewer", [[/* scores */], [/* proposals */]]);
    const res = await request(app).get(`/api/v1/companies/${COMPANY_ID}/trust`);
    expect(res.status).toBe(200);
  });

  it("2. POST /trust/proposals/:id/approve — viewer gets 403", async () => {
    const app = await buildTrustApp("viewer");
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/trust/proposals/${PROPOSAL_ID}/approve`)
      .send({});
    expect(res.status).toBe(403);
  });

  it("3. POST /trust/proposals/:id/approve — operator gets through (proposal found)", async () => {
    const app = await buildTrustApp("operator", [[PROPOSAL_ROW]]);
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/trust/proposals/${PROPOSAL_ID}/approve`)
      .send({});
    // 200 or 404 (proposal handled); the key is NOT 403
    expect(res.status).not.toBe(403);
  });

  it("4. POST /trust/proposals/:id/reject — viewer gets 403", async () => {
    const app = await buildTrustApp("viewer");
    const res = await request(app)
      .post(`/api/v1/companies/${COMPANY_ID}/trust/proposals/${PROPOSAL_ID}/reject`)
      .send({});
    expect(res.status).toBe(403);
  });

  // ── Intelligence route role enforcement ────────────────────────────────────

  it("5. PATCH /intelligence-cards/:id/read — viewer gets 403", async () => {
    const app = await buildIntelligenceApp("viewer");
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/intelligence-cards/${CARD_ID}/read`);
    expect(res.status).toBe(403);
  });

  it("6. PATCH /intelligence-cards/:id/read — operator gets through", async () => {
    const app = await buildIntelligenceApp("operator", [[CARD_ROW]]);
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/intelligence-cards/${CARD_ID}/read`);
    expect(res.status).not.toBe(403);
  });

  // ── Agent-config route role enforcement ────────────────────────────────────

  it("7. PUT /agents/:agentId/config — viewer gets 403", async () => {
    const app = await buildAgentConfigApp("viewer");
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ tone: "formal" });
    expect(res.status).toBe(403);
  });

  it("8. PUT /agents/:agentId/config — operator gets through", async () => {
    const app = await buildAgentConfigApp("operator", [[{ id: AGENT_ID, companyId: COMPANY_ID, metadata: {} }]]);
    const res = await request(app)
      .put(`/api/v1/companies/${COMPANY_ID}/agents/${AGENT_ID}/config`)
      .send({ tone: "formal" });
    expect(res.status).not.toBe(403);
  });

  // ── Member management routes ───────────────────────────────────────────────

  it("9. GET /singular/members — returns members list", async () => {
    const app = await buildMembersApp("viewer", [[MEMBER_ROW]]);
    const res = await request(app).get(`/api/v1/companies/${COMPANY_ID}/singular/members`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.members)).toBe(true);
  });

  it("10. PATCH /singular/members/:mid/role — viewer gets 403", async () => {
    const app = await buildMembersApp("viewer");
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/singular/members/${MEMBER_ID}/role`)
      .send({ role: "operator" });
    expect(res.status).toBe(403);
  });

  it("11. PATCH /singular/members/:mid/role — admin can change role", async () => {
    const app = await buildMembersApp("admin", [[OPERATOR_MEMBERSHIP]]);
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/singular/members/${MEMBER_ID}/role`)
      .send({ role: "operator" });
    expect(res.status).toBe(200);
  });

  it("12. PATCH /singular/members/:mid/role — non-owner cannot assign 'owner' role", async () => {
    const app = await buildMembersApp("admin", [[OPERATOR_MEMBERSHIP]]);
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/singular/members/${MEMBER_ID}/role`)
      .send({ role: "owner" });
    expect(res.status).toBe(403);
  });

  it("13. PATCH /singular/members/:mid/role — 409 when demoting last owner", async () => {
    // Existing member is owner, we try to demote, only 1 owner exists
    const app = await buildMembersApp(
      "owner",
      [
        [OWNER_MEMBERSHIP],           // existing row
        [{ count: 1 }],               // ownerCount
      ],
      [{ id: MEMBER_ID, role: "admin" }],
    );
    const res = await request(app)
      .patch(`/api/v1/companies/${COMPANY_ID}/singular/members/${MEMBER_ID}/role`)
      .send({ role: "admin" });
    expect(res.status).toBe(409);
  });

  it("14. DELETE /singular/members/:mid — viewer gets 403", async () => {
    const app = await buildMembersApp("viewer");
    const res = await request(app)
      .delete(`/api/v1/companies/${COMPANY_ID}/singular/members/${MEMBER_ID}`);
    expect(res.status).toBe(403);
  });

  it("15. DELETE /singular/members/:mid — admin soft-deletes member", async () => {
    const app = await buildMembersApp("admin", [[OPERATOR_MEMBERSHIP]]);
    const res = await request(app)
      .delete(`/api/v1/companies/${COMPANY_ID}/singular/members/${MEMBER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("16. DELETE /singular/members/:mid — 409 when removing last owner", async () => {
    const app = await buildMembersApp(
      "admin",
      [
        [OWNER_MEMBERSHIP],           // existing row
        [{ count: 1 }],               // ownerCount
      ],
    );
    const res = await request(app)
      .delete(`/api/v1/companies/${COMPANY_ID}/singular/members/${MEMBER_ID}`);
    expect(res.status).toBe(409);
  });
});
