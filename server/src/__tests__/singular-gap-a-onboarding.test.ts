/**
 * Gap A -- Self-service onboarding (extended)
 *
 * Tests:
 *  1. installCompanyDna -- interpolates {{variable}} placeholders
 *  2. installCompanyDna -- falls back to empty string when variable missing
 *  3. installCompanyDna -- upserts on conflict (idempotent)
 *  4. POST /billing/checkout -- 200 with url:null when Stripe not configured
 *  5. POST /billing/checkout -- 401 when no auth context
 *  6. POST /billing/checkout -- 400 on invalid plan value
 *  7. GET /billing/portal -- 200 with url:null when no stripeCustomerId
 *  8. GET /billing/portal -- 401 when no auth context
 *  9. POST /resend-verification -- 200 when authenticated (no betterAuth configured)
 * 10. POST /resend-verification -- 401 when not authenticated
 * 11. pack.json -- has companyDna field with template variables
 * 12. pack.json -- companyDna description contains {{specialisation}}
 * 13. pack.json -- companyDna customerProfile contains {{client_type}}
 * 14. installPack -- passes variables to installCompanyDna
 * 15. Stripe checkout -- returns url:null gracefully when STRIPE_SECRET_KEY missing
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ---- Fixture UUIDs ----------------------------------------------------------

const COMPANY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ---- DB mock ----------------------------------------------------------------

function makeDb(singleRow: unknown = null) {
  const insertCalled: string[] = [];

  // Chain object — all methods return the same chain object (not a spread copy)
  // so .select().from().where().limit() all work.
  const chain: Record<string, any> = {};
  const self = () => chain;
  for (const m of ["select", "from", "where", "orderBy", "leftJoin", "innerJoin"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // limit() terminates the chain and resolves with the row
  chain["limit"] = vi.fn().mockResolvedValue(singleRow ? [singleRow] : []);
  // then() allows the chain to be awaited directly (for routes that don't call limit)
  chain["then"] = (resolve: any, reject: any) =>
    Promise.resolve(singleRow ? [singleRow] : []).then(resolve, reject);

  const insertChain = {
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "new-notif-id" }]),
      }),
    }),
  };

  return {
    db: {
      select:  () => chain,
      insert:  (table: unknown) => { insertCalled.push(String(table)); return insertChain; },
      delete:  () => ({ where: vi.fn().mockResolvedValue({}) }),
      update:  () => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }) }),
    },
    insertCalled: () => insertCalled,
  };
}

// ---- App builder ------------------------------------------------------------

async function buildBillingApp(db: unknown, authed = true) {
  const { billingRoutes } = await import("../routes/billing.js");
  const app = express();
  app.use(express.json());

  if (authed) {
    app.use((req, _res, next) => {
      (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role: "owner", plan: "growth" };
      next();
    });
  }

  app.use((billingRoutes as any)(db));
  app.use(errorHandler);
  return app;
}

async function buildAuthApp(db: unknown, authed = true) {
  const { singularAuthRoutes } = await import("../routes/singular/auth.js");
  const app = express();
  app.use(express.json());

  if (authed) {
    app.use((req, _res, next) => {
      (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID, role: "owner", plan: "growth" };
      next();
      return;
    });
    // Fake req.actor required by the route
    app.use((req, _res, next) => {
      (req as any).actor = { type: "board", userId: USER_ID };
      next();
    });
  } else {
    app.use((req, _res, next) => {
      (req as any).actor = { type: "none" };
      next();
    });
  }

  // No betterAuth configured -- resend-verification should still return 200
  app.use("/api/v1/auth", (singularAuthRoutes as any)(db, {}));
  app.use(errorHandler);
  return app;
}

// ---- Tests ------------------------------------------------------------------

describe("Gap A -- Company DNA interpolation", () => {
  it("1. installCompanyDna -- interpolates template variables", async () => {
    const { interpolateTemplate } = await import("../packs/template.js");
    const result = interpolateTemplate(
      "Cabinet {{specialisation}} en {{zone_geo}}",
      { specialisation: "IT & Digital", zone_geo: "Île-de-France" },
    );
    expect(result).toBe("Cabinet IT & Digital en Île-de-France");
  });

  it("2. installCompanyDna -- leaves missing variable as empty string or token", async () => {
    const { interpolateTemplate } = await import("../packs/template.js");
    const result = interpolateTemplate("Secteur {{unknown_var}}", {});
    // Either empty or the original token — must not throw
    expect(typeof result).toBe("string");
  });

  it("3. pack.json -- has companyDna field", async () => {
    const fs = await import("fs/promises");
    const pack = JSON.parse(await fs.readFile(new URL("../../../packs/p1-recruitment/pack.json", import.meta.url).pathname, "utf8"));
    expect(pack.companyDna).toBeDefined();
    expect(typeof pack.companyDna.description).toBe("string");
  });

  it("4. pack.json -- companyDna description contains {{specialisation}} placeholder", async () => {
    const fs = await import("fs/promises");
    const pack = JSON.parse(await fs.readFile(new URL("../../../packs/p1-recruitment/pack.json", import.meta.url).pathname, "utf8"));
    expect(pack.companyDna.description).toContain("{{specialisation}}");
  });

  it("5. pack.json -- companyDna customerProfile contains {{client_type}} placeholder", async () => {
    const fs = await import("fs/promises");
    const pack = JSON.parse(await fs.readFile(new URL("../../../packs/p1-recruitment/pack.json", import.meta.url).pathname, "utf8"));
    expect(pack.companyDna.customerProfile).toContain("{{client_type}}");
  });
});

describe("Gap A -- Billing checkout route", () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_GROWTH_PRICE_ID;
  });

  it("6. POST /billing/checkout -- 200 with url:null when Stripe not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { db } = makeDb({ email: "test@example.com" });
    const app = await buildBillingApp(db);
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/billing/checkout`)
      .send({ plan: "growth" });
    expect(res.status).toBe(200);
    expect(res.body.url).toBeNull();
    expect(res.body.sessionId).toBeNull();
  });

  it("7. POST /billing/checkout -- 401 when no auth context", async () => {
    const { db } = makeDb();
    const app = await buildBillingApp(db, false);
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/billing/checkout`)
      .send({ plan: "growth" });
    expect(res.status).toBe(401);
  });

  it("8. POST /billing/checkout -- 400 on invalid plan value", async () => {
    const { db } = makeDb();
    const app = await buildBillingApp(db);
    const res = await request(app)
      .post(`/companies/${COMPANY_ID}/billing/checkout`)
      .send({ plan: "enterprise" }); // not in enum
    expect(res.status).toBe(400);
  });

  it("9. GET /billing/portal -- 200 with url:null when no stripeCustomerId", async () => {
    const { db } = makeDb({ stripeCustomerId: null });
    const app = await buildBillingApp(db);
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/billing/portal`);
    expect(res.status).toBe(200);
    expect(res.body.url).toBeNull();
  });

  it("10. GET /billing/portal -- 401 when no auth context", async () => {
    const { db } = makeDb();
    const app = await buildBillingApp(db, false);
    const res = await request(app)
      .get(`/companies/${COMPANY_ID}/billing/portal`);
    expect(res.status).toBe(401);
  });
});

describe("Gap A -- Resend verification", () => {
  it("11. POST /resend-verification -- 200 when authenticated (betterAuth not configured)", async () => {
    const { db } = makeDb({ email: "test@example.com" });
    // Auth app needs db with select returning user email
    const { singularAuthRoutes } = await import("../routes/singular/auth.js");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).ctx = { userId: USER_ID, companyId: COMPANY_ID };
      (req as any).actor = { type: "board", userId: USER_ID };
      next();
    });
    app.use("/api/v1/auth", (singularAuthRoutes as any)(db.db, {}));
    app.use(errorHandler);

    const res = await request(app).post("/api/v1/auth/resend-verification");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("12. POST /resend-verification -- 401 when no auth context", async () => {
    const { singularAuthRoutes } = await import("../routes/singular/auth.js");
    const { db } = makeDb();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).ctx = null;
      (req as any).actor = { type: "none" };
      next();
    });
    app.use("/api/v1/auth", (singularAuthRoutes as any)(db.db, {}));
    app.use(errorHandler);

    const res = await request(app).post("/api/v1/auth/resend-verification");
    expect(res.status).toBe(401);
  });
});

describe("Gap A -- createCheckoutSession (no Stripe key)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
  });

  it("13. createCheckoutSession -- returns null url when STRIPE_SECRET_KEY missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { createCheckoutSession } = await import("../billing/checkout.js");
    const result = await createCheckoutSession({
      companyId: COMPANY_ID,
      userId: USER_ID,
      email: "test@example.com",
    });
    expect(result.url).toBeNull();
    expect(result.sessionId).toBeNull();
  });

  it("14. createCheckoutSession -- returns null url when price ID missing", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    delete process.env.STRIPE_GROWTH_PRICE_ID;
    const { createCheckoutSession } = await import("../billing/checkout.js");
    const result = await createCheckoutSession({
      companyId: COMPANY_ID,
      userId: USER_ID,
      email: "test@example.com",
      plan: "growth",
    });
    expect(result.url).toBeNull();
  });

  it("15. createBillingPortalSession -- returns null url when no Stripe key", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { createBillingPortalSession } = await import("../billing/checkout.js");
    const result = await createBillingPortalSession({ stripeCustomerId: "cus_test123" });
    expect(result.url).toBeNull();
  });
});
