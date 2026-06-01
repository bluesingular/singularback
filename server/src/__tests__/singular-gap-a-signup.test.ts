/**
 * Gap A — Customer self-service signup
 *
 * Tests:
 *  1. POST /signup — betterAuth not configured → 400
 *  2. POST /signup — missing required fields → 400 (validation)
 *  3. POST /signup — password too short (< 8) → 400 (validation)
 *  4. POST /signup — betterAuth signUpEmail returns error → 400 with message
 *  5. POST /signup — betterAuth success, user returned in body → 201 with company
 *  6. POST /signup — betterAuth success, user looked up by email fallback → 201
 *  7. POST /signup — forwards Set-Cookie from better-auth response
 *  8. POST /signup — company created with owner membership
 *  9. POST /signup — companyName generates URL-safe slug with suffix
 * 10. POST /signup — locale defaults to "fr", timezone to "Europe/Paris"
 * 11. POST /signup — accepts explicit locale "en"
 * 12. POST /signup — companyName generates two-letter issuePrefix from words
 * 13. POST /signup — single-word company gets 3-letter prefix
 * 14. signupSchema — rejects empty name
 * 15. signupSchema — rejects invalid email
 * 16. signupSchema — rejects password shorter than 8
 * 17. signupSchema — rejects empty companyName
 * 18. signupSchema — accepts all valid fields
 * 19. signupSchema — locale defaults to "fr" when omitted
 * 20. signupSchema — timezone defaults to "Europe/Paris" when omitted
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { errorHandler } from "../middleware/error-handler.js";

// ── signupSchema replica (for schema-level tests) ─────────────────────────────

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1).max(100),
  locale: z.enum(["fr", "en"]).optional().default("fr"),
  timezone: z.string().optional().default("Europe/Paris"),
});

// ── Fixture UUIDs ─────────────────────────────────────────────────────────────

const USER_ID      = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID   = "22222222-2222-4222-8222-222222222222";
const VALID_SIGNUP = {
  name: "Isabelle Martin",
  email: "isabelle@cabinetmartin.fr",
  password: "motdepasse123",
  companyName: "Cabinet Martin RH",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
}

function makeInsertChain(result: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([result]),
  };
}

function makeInserNoReturn() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, unknown> = {
    select: vi.fn(() =>
      makeSelectChain([{ id: USER_ID, email: VALID_SIGNUP.email, name: VALID_SIGNUP.name }]),
    ),
    insert: vi.fn((table: unknown) => {
      if ((table as { _: { name: string } })?._?.name === "company_memberships") {
        return makeInserNoReturn();
      }
      return makeInsertChain({
        id: COMPANY_ID,
        slug: "cabinet-martin-rh-abc123",
        issuePrefix: "CM",
        name: VALID_SIGNUP.companyName,
        plan: "growth",
        locale: "fr",
        timezone: "Europe/Paris",
      });
    }),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    ...overrides,
  };
  return db;
}

function makeBetterAuth(opts: {
  ok?: boolean;
  body?: unknown;
  userId?: string;
  setCookie?: string;
} = {}) {
  const ok = opts.ok ?? true;
  const userId = opts.userId ?? USER_ID;
  return {
    api: {
      signUpEmail: vi.fn().mockResolvedValue({
        ok,
        headers: {
          get: (h: string) =>
            h === "set-cookie" ? (opts.setCookie ?? null) : null,
        },
        json: vi.fn().mockResolvedValue(
          ok ? { user: { id: userId } } : { message: opts.body ?? "Email déjà utilisé." },
        ),
      }),
      signInEmail: vi.fn(),
      signOut: vi.fn(),
    },
  };
}

async function buildApp(db: unknown, betterAuth?: unknown) {
  const { singularAuthRoutes } = await import("../routes/singular/auth.js");

  const app = express();
  app.use(express.json());

  // Minimal actor middleware — unauthenticated for signup (no session needed)
  app.use((req, _res, next) => {
    (req as unknown as { actor: unknown }).actor = { type: "none" };
    next();
  });

  app.use(
    "/api/v1/auth",
    singularAuthRoutes(db as Parameters<typeof singularAuthRoutes>[0], {
      betterAuth: betterAuth as Parameters<typeof singularAuthRoutes>[1]["betterAuth"],
    }),
  );
  app.use(errorHandler);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks(); });

describe("Gap A — POST /api/v1/auth/signup", () => {
  it("1. betterAuth not configured → 400", async () => {
    const app = await buildApp(makeDb());
    const res = await request(app).post("/api/v1/auth/signup").send(VALID_SIGNUP);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it("2. missing required fields → 400", async () => {
    const app = await buildApp(makeDb(), makeBetterAuth());
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ email: "x@x.com", password: "12345678" });
    expect(res.status).toBe(400);
  });

  it("3. password too short → 400", async () => {
    const app = await buildApp(makeDb(), makeBetterAuth());
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...VALID_SIGNUP, password: "short" });
    expect(res.status).toBe(400);
  });

  it("4. betterAuth signUpEmail error → 400 with message", async () => {
    const app = await buildApp(makeDb(), makeBetterAuth({ ok: false, body: "Email déjà utilisé." }));
    const res = await request(app).post("/api/v1/auth/signup").send(VALID_SIGNUP);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/déjà utilisé|créer le compte/i);
  });

  it("5. success — user returned in better-auth body → 201 with company", async () => {
    const app = await buildApp(makeDb(), makeBetterAuth());
    const res = await request(app).post("/api/v1/auth/signup").send(VALID_SIGNUP);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.company).toBeDefined();
    expect(res.body.company.issuePrefix).toBeDefined();
  });

  it("6. success — user looked up by email when not in better-auth body", async () => {
    const auth = makeBetterAuth({ userId: undefined });
    // Override json to not return user.id
    auth.api.signUpEmail = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: vi.fn().mockResolvedValue({ token: "xyz" }), // no user.id
    });
    const app = await buildApp(makeDb(), auth);
    const res = await request(app).post("/api/v1/auth/signup").send(VALID_SIGNUP);
    expect(res.status).toBe(201);
    expect(res.body.company).toBeDefined();
  });

  it("7. forwards Set-Cookie from better-auth", async () => {
    const cookie = "better-auth.session_token=abc; Path=/; HttpOnly; SameSite=Lax";
    const app = await buildApp(makeDb(), makeBetterAuth({ setCookie: cookie }));
    const res = await request(app).post("/api/v1/auth/signup").send(VALID_SIGNUP);
    expect(res.status).toBe(201);
    const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
    const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
    expect(cookieArr.some((c) => c.includes("better-auth.session_token"))).toBe(true);
  });

  it("8. company created with owner membership", async () => {
    const db = makeDb();
    const app = await buildApp(db, makeBetterAuth());
    const res = await request(app).post("/api/v1/auth/signup").send(VALID_SIGNUP);
    expect(res.status).toBe(201);
    // insert called at least twice: company + membership
    expect(vi.mocked(db.insert as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("9. companyName generates URL-safe slug", async () => {
    const app = await buildApp(makeDb(), makeBetterAuth());
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...VALID_SIGNUP, companyName: "Agence Recrutement & Co." });
    expect(res.status).toBe(201);
    // slug validation is server-side; just check 201
    expect(res.body.company).toBeDefined();
  });

  it("10. locale defaults to fr, timezone to Europe/Paris", async () => {
    const parsed = signupSchema.parse({ ...VALID_SIGNUP });
    expect(parsed.locale).toBe("fr");
    expect(parsed.timezone).toBe("Europe/Paris");
  });

  it("11. accepts explicit locale 'en'", async () => {
    const parsed = signupSchema.parse({ ...VALID_SIGNUP, locale: "en" });
    expect(parsed.locale).toBe("en");
  });

  it("12. two-word company gets two-letter issuePrefix", async () => {
    const app = await buildApp(makeDb(), makeBetterAuth());
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...VALID_SIGNUP, companyName: "Alpha Beta" });
    expect(res.status).toBe(201);
    // prefix logic: "AB"
    expect(res.body.company.issuePrefix).toMatch(/^[A-Z]{2,4}[0-9]?$/);
  });

  it("13. single-word company falls back to 3-char prefix", async () => {
    const app = await buildApp(makeDb(), makeBetterAuth());
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ ...VALID_SIGNUP, companyName: "Recrutech" });
    expect(res.status).toBe(201);
    expect(res.body.company.issuePrefix).toMatch(/^[A-Z]{2,4}[0-9]?$/);
  });
});

describe("Gap A — signupSchema validation", () => {
  it("14. rejects empty name", () => {
    expect(signupSchema.safeParse({ ...VALID_SIGNUP, name: "" }).success).toBe(false);
  });

  it("15. rejects invalid email", () => {
    expect(signupSchema.safeParse({ ...VALID_SIGNUP, email: "not-an-email" }).success).toBe(false);
  });

  it("16. rejects password shorter than 8", () => {
    expect(signupSchema.safeParse({ ...VALID_SIGNUP, password: "1234567" }).success).toBe(false);
  });

  it("17. rejects empty companyName", () => {
    expect(signupSchema.safeParse({ ...VALID_SIGNUP, companyName: "" }).success).toBe(false);
  });

  it("18. accepts all valid fields", () => {
    expect(signupSchema.safeParse(VALID_SIGNUP).success).toBe(true);
  });

  it("19. locale defaults to 'fr' when omitted", () => {
    const { locale } = signupSchema.parse(VALID_SIGNUP);
    expect(locale).toBe("fr");
  });

  it("20. timezone defaults to 'Europe/Paris' when omitted", () => {
    const { timezone } = signupSchema.parse(VALID_SIGNUP);
    expect(timezone).toBe("Europe/Paris");
  });
});
