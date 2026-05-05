/**
 * server/src/routes/singular/auth.ts
 *
 * Singular.blue authentication and company-switcher routes.
 *
 * These sit alongside better-auth's own /api/auth/* endpoints and add:
 *   - /me         — current user + full company list + active company context
 *   - /switch     — validate and activate a different company (client-side state)
 *   - /signup     — Gap A: create user + company in one request (self-service onboarding)
 *   - /login      — thin wrapper around better-auth sign-in; returns me payload
 *   - /logout     — delegates to better-auth signOut
 *   - /google     — initiates Google OAuth via better-auth
 *   - /google/callback — post-OAuth redirect after better-auth handles the callback
 *
 * All routes under /api/v1/auth/*.
 * Login/logout/Google are intentionally thin wrappers so the client has a single
 * consistent API surface (/api/v1/*) rather than knowing about /api/auth/* internals.
 */

import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers, companies, companyMemberships } from "@paperclipai/db";
import { validate } from "../../middleware/validate.js";
import { unauthorized, forbidden, badRequest } from "../../errors.js";
import type { RequestContext } from "../../middleware/company-context.js";
import { normaliseRole, normalisePlan } from "../../middleware/company-context.js";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const switchSchema = z.object({
  companyId: z.string().uuid(),
});

const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1).max(100),
  locale: z.enum(["fr", "en"]).optional().default("fr"),
  timezone: z.string().optional().default("Europe/Paris"),
});

// ── Better-auth interface (minimal surface we need) ───────────────────────────

interface BetterAuthApi {
  api: {
    signUpEmail: (opts: {
      body: { name: string; email: string; password: string };
      asResponse: true;
    }) => Promise<Response>;
    signInEmail: (opts: {
      body: { email: string; password: string };
      asResponse: true;
    }) => Promise<Response>;
    signOut: (opts: {
      headers: Headers;
      asResponse: true;
    }) => Promise<Response>;
  };
}

// ── Route factory ─────────────────────────────────────────────────────────────

export function singularAuthRoutes(
  db: Db,
  opts: { betterAuth?: BetterAuthApi; appUrl?: string } = {},
): Router {
  const router = Router();

  // ── GET /api/v1/auth/me ───────────────────────────────────────────────────
  // Returns: { user, companies, activeCompany }
  // activeCompany is null if user belongs to no company yet.

  router.get("/me", async (req, res, next) => {
    try {
      if (req.actor.type === "none") throw unauthorized();

      const userId = req.actor.type === "board" ? req.actor.userId : req.actor.agentId;
      if (!userId) throw unauthorized();

      const [user, memberships] = await Promise.all([
        req.actor.type === "board"
          ? db
              .select({ id: authUsers.id, email: authUsers.email, name: authUsers.name })
              .from(authUsers)
              .where(eq(authUsers.id, userId))
              .then((rows) => rows[0] ?? null)
          : Promise.resolve(null),

        db
          .select({
            companyId: companyMemberships.companyId,
            role: companyMemberships.membershipRole,
            companyName: companies.name,
            companySlug: companies.slug,
            companyPlan: companies.plan,
            companyStatus: companies.status,
          })
          .from(companyMemberships)
          .innerJoin(companies, eq(companies.id, companyMemberships.companyId))
          .where(
            and(
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.principalId, userId),
              eq(companyMemberships.status, "active"),
            ),
          ),
      ]);

      res.json({
        user: user
          ? { id: user.id, email: user.email, name: user.name }
          : { id: userId, email: null, name: null },
        companies: memberships.map((m) => ({
          id: m.companyId,
          name: m.companyName,
          slug: m.companySlug,
          plan: normalisePlan(m.companyPlan),
          role: normaliseRole(m.role),
        })),
        activeCompany: req.ctx ?? null,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /api/v1/auth/switch ──────────────────────────────────────────────
  // Validates the user is a member of the requested company, then returns the
  // new context. The client stores companyId and sends it as x-singular-company-id
  // on subsequent requests — no server-side session mutation needed.

  router.post(
    "/switch",
    validate(switchSchema),
    async (req, res, next) => {
      try {
        if (req.actor.type !== "board") throw forbidden("Company switching requires a user session.");

        const userId = req.actor.userId;
        if (!userId) throw unauthorized();

        const { companyId } = req.body as z.infer<typeof switchSchema>;

        const membership = await db
          .select({
            role: companyMemberships.membershipRole,
            companyPlan: companies.plan,
            companyName: companies.name,
            companySlug: companies.slug,
            companyLocale: companies.locale,
            companyTimezone: companies.timezone,
          })
          .from(companyMemberships)
          .innerJoin(companies, eq(companies.id, companyMemberships.companyId))
          .where(
            and(
              eq(companyMemberships.companyId, companyId),
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.principalId, userId),
              eq(companyMemberships.status, "active"),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!membership) {
          throw forbidden("Vous n'êtes pas membre de cette entreprise.");
        }

        const ctx: RequestContext = {
          userId,
          companyId,
          role: normaliseRole(membership.role),
          plan: normalisePlan(membership.companyPlan),
          locale: membership.companyLocale ?? "fr",
          timezone: membership.companyTimezone ?? "Europe/Paris",
        };

        res.json({
          activeCompany: ctx,
          company: {
            id: companyId,
            name: membership.companyName,
            slug: membership.companySlug,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /api/v1/auth/signup ─────────────────────────────────────────────
  // Gap A: Self-service onboarding — creates user + company in one atomic step.
  //
  // Flow:
  //   1. better-auth creates the user account (email + hashed password)
  //   2. We look up the new user row by email
  //   3. We create a company with locale/timezone from the request
  //   4. We create an owner membership
  //   5. We forward the Set-Cookie from better-auth so the session is established
  //   6. We return { company: { id, slug, issuePrefix } } so the client can redirect

  router.post(
    "/signup",
    validate(signupSchema),
    async (req, res, next) => {
      try {
        if (!opts.betterAuth) {
          throw badRequest("Authentication not configured on this instance.");
        }

        const { name, email, password, companyName, locale, timezone } =
          req.body as z.infer<typeof signupSchema>;

        // 1. Create the user via better-auth
        const authResponse = await opts.betterAuth.api.signUpEmail({
          body: { name, email, password },
          asResponse: true,
        });

        // Forward Set-Cookie so the session is established on the client
        const setCookieHeader = authResponse.headers.get("set-cookie");
        if (setCookieHeader) {
          const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/);
          for (const cookie of cookies) {
            res.append("Set-Cookie", cookie.trim());
          }
        }

        if (!authResponse.ok) {
          const body = (await authResponse.json().catch(() => ({}))) as { message?: string };
          throw badRequest(body.message ?? "Impossible de créer le compte. Cet e-mail est peut-être déjà utilisé.");
        }

        // 2. Resolve the new user row — better-auth returns { user: { id } } on success
        const authBody = (await authResponse.json().catch(() => null)) as
          | { user?: { id?: string } }
          | null;
        let userId = authBody?.user?.id;

        if (!userId) {
          // Fallback: look up by email
          const row = await db
            .select({ id: authUsers.id })
            .from(authUsers)
            .where(eq(authUsers.email, email.toLowerCase().trim()))
            .then((rows) => rows[0] ?? null);
          userId = row?.id;
        }

        if (!userId) {
          throw badRequest("Compte créé mais introuvable — veuillez vous connecter manuellement.");
        }

        // 3. Generate company slug from name (mirror of services/companies.ts logic)
        const base = companyName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;

        // 4. Create company + owner membership in a transaction
        const newCompany = await db.transaction(async (tx) => {
          // Derive a unique 2–4 letter issue prefix from the company name
          const words = companyName.trim().split(/\s+/);
          const rawPrefix = words.length >= 2
            ? (words[0][0] + words[1][0]).toUpperCase()
            : companyName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "");
          const prefix = rawPrefix || "CIE";

          // Ensure prefix uniqueness with a counter suffix
          const existingPrefixes = await tx
            .select({ issuePrefix: companies.issuePrefix })
            .from(companies)
            .then((rows) => new Set(rows.map((r) => r.issuePrefix)));

          let finalPrefix = prefix;
          let attempt = 1;
          while (existingPrefixes.has(finalPrefix)) {
            finalPrefix = `${prefix}${attempt}`;
            attempt++;
          }

          const [created] = await tx
            .insert(companies)
            .values({
              name: companyName,
              slug,
              issuePrefix: finalPrefix,
              plan: "growth",
              locale,
              timezone,
            })
            .returning();

          await tx.insert(companyMemberships).values({
            principalType: "user",
            principalId: userId!,
            companyId: created.id,
            membershipRole: "owner",
            status: "active",
          });

          return created;
        });

        res.status(201).json({
          success: true,
          company: {
            id: newCompany.id,
            slug: newCompany.slug,
            issuePrefix: newCompany.issuePrefix,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /api/v1/auth/login ───────────────────────────────────────────────
  // Delegates to better-auth's email sign-in. Forwards Set-Cookie headers so
  // the browser session is established, then returns the /me payload.

  router.post(
    "/login",
    validate(loginSchema),
    async (req, res, next) => {
      try {
        if (!opts.betterAuth) {
          throw badRequest("Authentication not configured on this instance.");
        }

        const { email, password } = req.body as z.infer<typeof loginSchema>;

        const authResponse = await opts.betterAuth.api.signInEmail({
          body: { email, password },
          asResponse: true,
        });

        // Forward all Set-Cookie headers from better-auth to the client
        const setCookieHeader = authResponse.headers.get("set-cookie");
        if (setCookieHeader) {
          // Split multi-cookie headers (better-auth may set multiple)
          const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/);
          for (const cookie of cookies) {
            res.append("Set-Cookie", cookie.trim());
          }
        }

        if (!authResponse.ok) {
          const body = (await authResponse.json().catch(() => ({}))) as {
            message?: string;
          };
          const message = body.message ?? "Email ou mot de passe incorrect.";
          throw badRequest(message);
        }

        // After sign-in, the actorMiddleware hasn't run again so req.actor is
        // still "none". Return minimal success — client will call /me next.
        res.status(200).json({ success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── POST /api/v1/auth/logout ──────────────────────────────────────────────

  router.post("/logout", async (req, res, next) => {
    try {
      if (!opts.betterAuth) {
        res.json({ success: true });
        return;
      }

      // Build Web Headers from Express request headers for better-auth
      const webHeaders = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (!value) continue;
        if (Array.isArray(value)) {
          for (const v of value) webHeaders.append(key, v);
        } else {
          webHeaders.set(key, value);
        }
      }

      const authResponse = await opts.betterAuth.api.signOut({
        headers: webHeaders,
        asResponse: true,
      });

      // Forward cookie-clearing headers from better-auth
      const setCookieHeader = authResponse.headers.get("set-cookie");
      if (setCookieHeader) {
        const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/);
        for (const cookie of cookies) {
          res.append("Set-Cookie", cookie.trim());
        }
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/v1/auth/google ───────────────────────────────────────────────
  // Initiates Google OAuth by redirecting to better-auth's social sign-in endpoint.
  // better-auth must be configured with the Google provider plugin for this to work.

  router.get("/google", (req, res) => {
    const callbackUrl = (req.query.callbackUrl as string | undefined) ?? "/";
    const betterAuthUrl = `/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackUrl)}`;
    res.redirect(betterAuthUrl);
  });

  // ── GET /api/v1/auth/google/callback ─────────────────────────────────────
  // better-auth handles the actual OAuth callback at /api/auth/callback/google.
  // This endpoint exists as a post-login redirect target: after better-auth
  // completes OAuth, it redirects here, and we redirect the user to the app.

  router.get("/google/callback", (req, res) => {
    const redirectTo = (req.query.callbackUrl as string | undefined) ?? "/";
    // Validate redirect to prevent open redirect — only allow relative paths
    const safe = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
    res.redirect(safe);
  });

  return router;
}
