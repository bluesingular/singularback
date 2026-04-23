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
import type { Db } from "@paperclipai/db";
interface BetterAuthApi {
    api: {
        signInEmail: (opts: {
            body: {
                email: string;
                password: string;
            };
            asResponse: true;
        }) => Promise<Response>;
        signOut: (opts: {
            headers: Headers;
            asResponse: true;
        }) => Promise<Response>;
    };
}
export declare function singularAuthRoutes(db: Db, opts?: {
    betterAuth?: BetterAuthApi;
    appUrl?: string;
}): Router;
export {};
//# sourceMappingURL=auth.d.ts.map