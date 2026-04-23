/**
 * server/src/routes/singular/auth.ts
 *
 * Singular.blue authentication and company-switcher routes.
 *
 * These sit alongside better-auth's own /api/auth/* endpoints and add:
 *   - /me         — current user + full company list + active company context
 *   - /switch     — validate and activate a different company (client-side state)
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

// ── Better-auth interface (minimal surface we need) ───────────────────────────

interface BetterAuthApi {
  api: {
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
