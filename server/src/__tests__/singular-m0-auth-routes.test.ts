/**
 * M0 — Multi-tenancy: /api/v1/auth/* route tests
 *
 * Tests:
 *  1. GET /me — unauthenticated → 401
 *  2. GET /me — board actor → returns user + companies + activeCompany
 *  3. GET /me — no memberships → empty companies array, activeCompany null
 *  4. POST /switch — not a board actor → 403
 *  5. POST /switch — not a member of requested company → 403
 *  6. POST /switch — valid member → returns activeCompany with correct role/plan
 *  7. POST /switch — invalid body → 400
 *  8. POST /login — betterAuth not configured → 400
 *  9. POST /login — betterAuth returns error → 400 with message
 * 10. POST /login — betterAuth success → 200 + forwards Set-Cookie
 * 11. POST /logout — delegates to betterAuth, forwards cookies
 * 12. GET /google — redirects to better-auth OAuth URL
 * 13. GET /google/callback — safe redirect to relative path
 * 14. GET /google/callback — blocks open redirect
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const companyId1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyId2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "user-abc123";

const mockUser = { id: userId, email: "ceo@agence.fr", name: "Marie Dupont" };

const mockMemberships = [
  {
    companyId: companyId1,
    role: "owner",
    companyName: "Agence Alpha",
    companySlug: "agence-alpha",
    companyPlan: "growth",
    companyStatus: "active",
  },
];

const mockMembershipForSwitch = {
  role: "owner",
  companyPlan: "growth",
  companyName: "Agence Alpha",
  companySlug: "agence-alpha",
};

// ── Mock DB ───────────────────────────────────────────────────────────────────

function makeQueryChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
}

function makeMockDb(scenarios: {
  userResult?: unknown[];
  membershipsResult?: unknown[];
  switchResult?: unknown[];
}) {
  let callIndex = 0;
  const results = [
    scenarios.userResult ?? [mockUser],
    scenarios.membershipsResult ?? [mockMemberships[0]],
  ];

  return {
    select: vi.fn().mockImplementation(() => {
      const result = results[callIndex] ?? [];
      callIndex++;
      return makeQueryChain(result);
    }),
  };
}

// ── App factory ───────────────────────────────────────────────────────────────

async function buildApp(opts: {
  actor: Record<string, unknown>;
  ctx?: Record<string, unknown> | null;
  db?: Record<string, unknown>;
  betterAuth?: Record<string, unknown>;
}) {
  const { singularAuthRoutes } =
    await vi.importActual<typeof import("../routes/singular/auth.js")>(
      "../routes/singular/auth.js",
    );

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as any).actor = opts.actor;
    if (opts.ctx !== undefined) (req as any).ctx = opts.ctx;
    next();
  });

  app.use(
    "/api/v1/auth",
    singularAuthRoutes(opts.db as any, {
      betterAuth: opts.betterAuth as any,
    }),
  );

  app.use(errorHandler);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/v1/auth/me", () => {
  it("1. unauthenticated → 401", async () => {
    const app = await buildApp({
      actor: { type: "none", source: "none" },
      db: makeMockDb({}),
    });
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("2. board actor → returns user + companies + activeCompany", async () => {
    const app = await buildApp({
      actor: { type: "board", userId, source: "session" },
      ctx: {
        userId,
        companyId: companyId1,
        role: "owner",
        plan: "growth",
      },
      db: makeMockDb({
        userResult: [mockUser],
        membershipsResult: mockMemberships,
      }),
    });
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: userId, email: "ceo@agence.fr" });
    expect(res.body.companies).toHaveLength(1);
    expect(res.body.companies[0]).toMatchObject({
      id: companyId1,
      role: "owner",
      plan: "growth",
    });
    expect(res.body.activeCompany).toMatchObject({ companyId: companyId1 });
  });

  it("3. board actor with no memberships → empty companies, null activeCompany", async () => {
    const app = await buildApp({
      actor: { type: "board", userId, source: "session" },
      ctx: null,
      db: makeMockDb({
        userResult: [mockUser],
        membershipsResult: [],
      }),
    });
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.companies).toHaveLength(0);
    expect(res.body.activeCompany).toBeNull();
  });
});

describe("POST /api/v1/auth/switch", () => {
  it("4. agent actor → 403", async () => {
    const app = await buildApp({
      actor: { type: "agent", agentId: "agent-1", companyId: companyId1, source: "agent_jwt" },
      db: makeMockDb({}),
    });
    const res = await request(app)
      .post("/api/v1/auth/switch")
      .send({ companyId: companyId1 });
    expect(res.status).toBe(403);
  });

  it("5. not a member of requested company → 403", async () => {
    const db = {
      select: vi.fn().mockImplementation(() => makeQueryChain([])), // no membership found
    };
    const app = await buildApp({
      actor: { type: "board", userId, source: "session" },
      db: db as any,
    });
    const res = await request(app)
      .post("/api/v1/auth/switch")
      .send({ companyId: companyId2 });
    expect(res.status).toBe(403);
  });

  it("6. valid member → returns activeCompany with correct role/plan", async () => {
    const db = {
      select: vi.fn().mockImplementation(() =>
        makeQueryChain([mockMembershipForSwitch]),
      ),
    };
    const app = await buildApp({
      actor: { type: "board", userId, source: "session" },
      db: db as any,
    });
    const res = await request(app)
      .post("/api/v1/auth/switch")
      .send({ companyId: companyId1 });
    expect(res.status).toBe(200);
    expect(res.body.activeCompany).toMatchObject({
      userId,
      companyId: companyId1,
      role: "owner",
      plan: "growth",
    });
    expect(res.body.company.slug).toBe("agence-alpha");
  });

  it("7. invalid body (missing companyId) → 400", async () => {
    const app = await buildApp({
      actor: { type: "board", userId, source: "session" },
      db: makeMockDb({}) as any,
    });
    const res = await request(app)
      .post("/api/v1/auth/switch")
      .send({ companyId: "not-a-uuid" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("8. betterAuth not configured → 400", async () => {
    const app = await buildApp({
      actor: { type: "none", source: "none" },
      db: makeMockDb({}) as any,
      // no betterAuth passed
    });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "test@example.com", password: "pass123" });
    expect(res.status).toBe(400);
  });

  it("9. betterAuth returns error response → 400 with message", async () => {
    const mockAuthResponse = new Response(
      JSON.stringify({ message: "Identifiants incorrects." }),
      { status: 401 },
    );
    const betterAuth = {
      api: {
        signInEmail: vi.fn().mockResolvedValue(mockAuthResponse),
      },
    };
    const app = await buildApp({
      actor: { type: "none", source: "none" },
      db: makeMockDb({}) as any,
      betterAuth,
    });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "bad@example.com", password: "wrong" });
    expect(res.status).toBe(400);
    expect(res.body.message ?? res.body.error).toMatch(/incorrects/i);
  });

  it("10. betterAuth success → 200 + Set-Cookie forwarded", async () => {
    const mockAuthResponse = new Response(
      JSON.stringify({ user: { id: userId } }),
      {
        status: 200,
        headers: { "set-cookie": "better-auth.session=abc123; Path=/; HttpOnly" },
      },
    );
    const betterAuth = {
      api: {
        signInEmail: vi.fn().mockResolvedValue(mockAuthResponse),
      },
    };
    const app = await buildApp({
      actor: { type: "none", source: "none" },
      db: makeMockDb({}) as any,
      betterAuth,
    });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ceo@agence.fr", password: "correct" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers["set-cookie"] as string[] | string | undefined;
    const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : (cookies ?? "");
    expect(cookieStr).toContain("better-auth.session");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("11. delegates to betterAuth and forwards Set-Cookie", async () => {
    const mockAuthResponse = new Response(JSON.stringify({}), {
      status: 200,
      headers: {
        "set-cookie": "better-auth.session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      },
    });
    const betterAuth = {
      api: {
        signOut: vi.fn().mockResolvedValue(mockAuthResponse),
      },
    };
    const app = await buildApp({
      actor: { type: "board", userId, source: "session" },
      db: makeMockDb({}) as any,
      betterAuth,
    });
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(betterAuth.api.signOut).toHaveBeenCalledOnce();
  });
});

describe("GET /api/v1/auth/google", () => {
  it("12. redirects to better-auth social sign-in URL", async () => {
    const app = await buildApp({
      actor: { type: "none", source: "none" },
      db: makeMockDb({}) as any,
    });
    const res = await request(app)
      .get("/api/v1/auth/google?callbackUrl=/dashboard")
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/api/auth/sign-in/social");
    expect(res.headers.location).toContain("provider=google");
  });
});

describe("GET /api/v1/auth/google/callback", () => {
  it("13. redirects to relative callbackUrl", async () => {
    const app = await buildApp({
      actor: { type: "none", source: "none" },
      db: makeMockDb({}) as any,
    });
    const res = await request(app)
      .get("/api/v1/auth/google/callback?callbackUrl=/dashboard")
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/dashboard");
  });

  it("14. blocks open redirect (absolute URL → redirects to /)", async () => {
    const app = await buildApp({
      actor: { type: "none", source: "none" },
      db: makeMockDb({}) as any,
    });
    const res = await request(app)
      .get("/api/v1/auth/google/callback?callbackUrl=https://evil.com/steal")
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });
});
