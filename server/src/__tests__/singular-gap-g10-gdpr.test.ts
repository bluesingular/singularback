/**
 * G10 — GDPR compliance routes
 *
 * Tests:
 *  1.  POST .../gdpr/contacts/:id/erase — 200 deletes contact + events + notes (owner)
 *  2.  POST .../gdpr/contacts/:id/erase — 403 for non-owner (admin role)
 *  3.  POST .../gdpr/contacts/:id/erase — 401 unauthenticated
 *  4.  POST .../gdpr/contacts/:id/erase — 404 when contact not in company
 *  5.  POST .../gdpr/users/:id/erase — 200 anonymises user + deletes sessions/accounts (owner)
 *  6.  POST .../gdpr/users/:id/erase — 403 for non-owner
 *  7.  POST .../gdpr/users/:id/erase — 404 when user not a company member
 *  8.  GET  .../gdpr/portability/contacts/:id — 200 returns JSON with contact + events + notes (admin)
 *  9.  GET  .../gdpr/portability/contacts/:id — 403 for viewer
 * 10.  GET  .../gdpr/portability/contacts/:id — 404 when contact not found
 * 11.  GET  .../gdpr/portability/users/:id — 200 returns JSON with user + memberships (owner)
 * 12.  GET  .../gdpr/portability/users/:id — 403 for non-owner (admin role)
 * 13.  GET  .../gdpr/audit.csv — 200 returns CSV with audit rows (admin)
 * 14.  GET  .../gdpr/audit.csv — 403 for viewer
 * 15.  POST .../gdpr/contacts/:id/erase — logs to gdpr_erasure_log
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Static mocks ──────────────────────────────────────────────────────────────

vi.mock("@paperclipai/db", () => ({
  contacts:                { id: "id", companyId: "companyId", fullName: "fullName", email: "email" },
  contactEvents:           { contactId: "contactId", companyId: "companyId", occurredAt: "occurredAt" },
  contactNotes:            { contactId: "contactId", companyId: "companyId", createdAt: "createdAt" },
  memoryEntries:           { companyId: "companyId", archived: "archived" },
  authUsers:               { id: "id", email: "email", name: "name", image: "image", createdAt: "createdAt" },
  authSessions:            { userId: "userId" },
  authAccounts:            { userId: "userId" },
  pushSubscriptions:       { userId: "userId", companyId: "companyId" },
  notificationPreferences: { userId: "userId", companyId: "companyId" },
  companyMemberships:      { id: "id", companyId: "companyId", principalId: "principalId" },
  auditEntries:            { id: "id", companyId: "companyId", agentId: "agentId", userId: "userId", taskId: "taskId", actionType: "actionType", result: "result", approvedBy: "approvedBy", approvedAt: "approvedAt", ipAddress: "ipAddress", createdAt: "createdAt" },
  gdprErasureLog:          { id: "id", companyId: "companyId", subjectType: "subjectType", subjectId: "subjectId", subjectLabel: "subjectLabel", requestedBy: "requestedBy", recordsDeleted: "recordsDeleted", retainedNote: "retainedNote", erasedAt: "erasedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq:   (...a: any[]) => ({ op: "eq",  a }),
  and:  (...a: any[]) => ({ op: "and", a }),
  desc: (...a: any[]) => ({ op: "desc", a }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID  = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONTACT_ID  = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER_ID     = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const CONTACT_ROW = { id: CONTACT_ID, companyId: COMPANY_ID, fullName: "Marie Dupont", email: "marie@example.com" };
const USER_ROW    = { id: USER_ID, email: "marie@example.com", name: "Marie Dupont", createdAt: new Date().toISOString() };
const MEMBERSHIP  = { id: "m1", companyId: COMPANY_ID, principalId: USER_ID };

// ── DB mock factory ───────────────────────────────────────────────────────────

function makeDb(opts: {
  contactFound?: boolean;
  userFound?: boolean;
  membershipFound?: boolean;
} = {}) {
  const { contactFound = true, userFound = true, membershipFound = true } = opts;

  let selectCount = 0;

  const makeChain = (rows: unknown[]) => {
    const c: any = {};
    for (const m of ["from", "where", "orderBy", "limit"]) c[m] = vi.fn().mockReturnValue(c);
    c.then  = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
    c.limit = vi.fn().mockResolvedValue(rows);
    return c;
  };

  const insertLog: string[] = [];

  const db: any = {
    select: vi.fn(() => {
      selectCount++;
      // Dispatch based on call order
      if (selectCount === 1) return makeChain(contactFound ? [CONTACT_ROW] : []);
      if (selectCount === 2) return makeChain(membershipFound ? [MEMBERSHIP] : []);
      if (selectCount === 3) return makeChain(userFound ? [USER_ROW] : []);
      return makeChain([]);
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      }),
    }),
    insert: vi.fn(() => ({
      values: vi.fn().mockImplementation((v: any) => {
        insertLog.push(v.subjectType ?? "unknown");
        return Promise.resolve([{ id: "log-1" }]);
      }),
    })),
    _insertLog: insertLog,
  };

  return db;
}

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp(role: "owner" | "admin" | "viewer" | "none" = "owner", dbOpts: Parameters<typeof makeDb>[0] = {}) {
  const db = makeDb(dbOpts);
  const { gdprRoutes } = await import("../routes/gdpr.js");

  const app = express();
  app.use(express.json());

  // Inject actor + ctx
  app.use((req, _res, next) => {
    if (role === "none") {
      (req as any).actor = { type: "none" };
      (req as any).ctx   = null;
    } else {
      (req as any).actor = {
        type: "board",
        userId: USER_ID,
        companyIds: [COMPANY_ID],
        source: "jwt",
        isInstanceAdmin: false,
        memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: role }],
      };
      (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role, plan: "growth" };
    }
    next();
  });

  app.use("/", gdprRoutes(db as any));
  app.use(errorHandler);
  return { app, db };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("G10 — GDPR compliance routes", () => {

  it("1. POST .../gdpr/contacts/:id/erase — 200 owner erases contact", async () => {
    const { app } = await buildApp("owner");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/gdpr/contacts/${CONTACT_ID}/erase`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.recordsDeleted).toBe("number");
  });

  it("2. POST .../gdpr/contacts/:id/erase — 403 for admin (not owner)", async () => {
    const { app } = await buildApp("admin");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/gdpr/contacts/${CONTACT_ID}/erase`);
    expect(res.status).toBe(403);
  });

  it("3. POST .../gdpr/contacts/:id/erase — 401 unauthenticated", async () => {
    const { app } = await buildApp("none");
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/gdpr/contacts/${CONTACT_ID}/erase`);
    expect(res.status).toBe(401);
  });

  it("4. POST .../gdpr/contacts/:id/erase — 404 contact not found", async () => {
    const { app } = await buildApp("owner", { contactFound: false });
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/gdpr/contacts/${CONTACT_ID}/erase`);
    expect(res.status).toBe(404);
  });

  it("5. POST .../gdpr/users/:id/erase — 200 owner anonymises user", async () => {
    // Need 3 selects: membership check, user load
    const db = makeDb({ userFound: true, membershipFound: true });
    // Reset select to return membership first, then user
    let sc = 0;
    const makeChain = (rows: unknown[]) => {
      const c: any = {};
      for (const m of ["from", "where", "orderBy"]) c[m] = vi.fn().mockReturnValue(c);
      c.limit = vi.fn().mockResolvedValue(rows);
      c.then  = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
      return c;
    };
    db.select = vi.fn(() => {
      sc++;
      if (sc === 1) return makeChain([MEMBERSHIP]); // membership check
      if (sc === 2) return makeChain([USER_ROW]);    // user load
      return makeChain([]);
    });

    const { gdprRoutes } = await import("../routes/gdpr.js");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: USER_ID, companyIds: [COMPANY_ID], source: "jwt", isInstanceAdmin: false, memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: "owner" }] };
      (req as any).ctx   = { userId: USER_ID, companyId: COMPANY_ID, role: "owner", plan: "growth" };
      next();
    });
    app.use("/", gdprRoutes(db as any));
    app.use(errorHandler);

    const res = await request(app).post(`/companies/${COMPANY_ID}/gdpr/users/${USER_ID}/erase`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.anonymised).toBe(true);
  });

  it("6. POST .../gdpr/users/:id/erase — 403 for admin", async () => {
    const { app } = await buildApp("admin");
    const res = await request(app).post(`/companies/${COMPANY_ID}/gdpr/users/${USER_ID}/erase`);
    expect(res.status).toBe(403);
  });

  it("7. POST .../gdpr/users/:id/erase — 404 when user not a member", async () => {
    // membership select returns empty
    const db = makeDb();
    const makeChain = (rows: unknown[]) => {
      const c: any = {};
      for (const m of ["from", "where", "orderBy"]) c[m] = vi.fn().mockReturnValue(c);
      c.limit = vi.fn().mockResolvedValue(rows);
      c.then  = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
      return c;
    };
    db.select = vi.fn(() => makeChain([])); // always empty

    const { gdprRoutes } = await import("../routes/gdpr.js");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: USER_ID, companyIds: [COMPANY_ID], source: "jwt", isInstanceAdmin: false, memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: "owner" }] };
      (req as any).ctx   = { userId: USER_ID, companyId: COMPANY_ID, role: "owner", plan: "growth" };
      next();
    });
    app.use("/", gdprRoutes(db as any));
    app.use(errorHandler);

    const res = await request(app).post(`/companies/${COMPANY_ID}/gdpr/users/${USER_ID}/erase`);
    expect(res.status).toBe(404);
  });

  it("8. GET .../gdpr/portability/contacts/:id — 200 admin gets JSON export", async () => {
    const { app } = await buildApp("admin");
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/gdpr/portability/contacts/${CONTACT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.exportType).toBe("article_20_portability");
    expect(res.body.subjectType).toBe("contact");
    expect(res.body).toHaveProperty("contact");
    expect(res.body).toHaveProperty("events");
    expect(res.body).toHaveProperty("notes");
  });

  it("9. GET .../gdpr/portability/contacts/:id — 403 for viewer", async () => {
    const { app } = await buildApp("viewer");
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/gdpr/portability/contacts/${CONTACT_ID}`);
    expect(res.status).toBe(403);
  });

  it("10. GET .../gdpr/portability/contacts/:id — 404 when not found", async () => {
    const { app } = await buildApp("admin", { contactFound: false });
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/gdpr/portability/contacts/${CONTACT_ID}`);
    expect(res.status).toBe(404);
  });

  it("11. GET .../gdpr/portability/users/:id — 200 owner gets user export", async () => {
    const db = makeDb();
    let sc = 0;
    const makeChain = (rows: unknown[]) => {
      const c: any = {};
      for (const m of ["from", "where", "orderBy"]) c[m] = vi.fn().mockReturnValue(c);
      c.limit = vi.fn().mockResolvedValue(rows);
      c.then  = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
      return c;
    };
    db.select = vi.fn(() => {
      sc++;
      if (sc === 1) return makeChain([USER_ROW]);
      if (sc === 2) return makeChain([MEMBERSHIP]);
      return makeChain([]);
    });

    const { gdprRoutes } = await import("../routes/gdpr.js");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: USER_ID, companyIds: [COMPANY_ID], source: "jwt", isInstanceAdmin: false, memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: "owner" }] };
      (req as any).ctx   = { userId: USER_ID, companyId: COMPANY_ID, role: "owner", plan: "growth" };
      next();
    });
    app.use("/", gdprRoutes(db as any));
    app.use(errorHandler);

    const res = await request(app).get(`/companies/${COMPANY_ID}/gdpr/portability/users/${USER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.exportType).toBe("article_20_portability");
    expect(res.body.subjectType).toBe("user");
    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("memberships");
  });

  it("12. GET .../gdpr/portability/users/:id — 403 for admin (owner required)", async () => {
    const { app } = await buildApp("admin");
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/gdpr/portability/users/${USER_ID}`);
    expect(res.status).toBe(403);
  });

  it("13. GET .../gdpr/audit.csv — 200 returns CSV text (admin)", async () => {
    const db = makeDb();
    const auditRow = {
      id: "a1", companyId: COMPANY_ID, agentId: null, userId: USER_ID,
      taskId: null, actionType: "approve_task", result: "success",
      approvedBy: null, approvedAt: null, ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    };
    const makeChain = (rows: unknown[]) => {
      const c: any = {};
      for (const m of ["from", "where", "orderBy"]) c[m] = vi.fn().mockReturnValue(c);
      c.then  = (res: any, rej: any) => Promise.resolve(rows).then(res, rej);
      return c;
    };
    db.select = vi.fn(() => makeChain([auditRow]));

    const { gdprRoutes } = await import("../routes/gdpr.js");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: USER_ID, companyIds: [COMPANY_ID], source: "jwt", isInstanceAdmin: false, memberships: [{ companyId: COMPANY_ID, status: "active", membershipRole: "admin" }] };
      (req as any).ctx   = { userId: USER_ID, companyId: COMPANY_ID, role: "admin", plan: "growth" };
      next();
    });
    app.use("/", gdprRoutes(db as any));
    app.use(errorHandler);

    const res = await request(app).get(`/companies/${COMPANY_ID}/gdpr/audit.csv`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("id,companyId");
    expect(res.text).toContain("approve_task");
  });

  it("14. GET .../gdpr/audit.csv — 403 for viewer", async () => {
    const { app } = await buildApp("viewer");
    const res = await request(app).get(`/companies/${COMPANY_ID}/gdpr/audit.csv`);
    expect(res.status).toBe(403);
  });

  it("15. POST .../gdpr/contacts/:id/erase — logs erasure to gdpr_erasure_log", async () => {
    const { app, db } = await buildApp("owner");
    await request(app).post(`/companies/${COMPANY_ID}/gdpr/contacts/${CONTACT_ID}/erase`);
    expect(db.insert).toHaveBeenCalled();
  });
});
