/**
 * company-context.ts
 *
 * Runs after actorMiddleware. Resolves the active company for the request,
 * fetches the user's role and the company's plan, and injects req.ctx.
 *
 * Also exports withTenantDb() — a helper that wraps DB calls in a transaction
 * with SET LOCAL app.company_id so PostgreSQL RLS policies are enforced.
 *
 * Active company resolution order (board/human users):
 *   1. x-singular-company-id request header  (set by React app after switcher call)
 *   2. First active membership (fallback for single-company users)
 *
 * Agent actors: companyId is already set on req.actor — just enrich with plan.
 */
import type { RequestHandler } from "express";
import type { Db } from "@paperclipai/db";
export interface RequestContext {
    userId: string;
    companyId: string;
    role: "owner" | "admin" | "manager" | "viewer";
    plan: "solo" | "growth" | "pro" | "enterprise";
}
export declare function companyContextMiddleware(db: Db): RequestHandler;
/**
 * Wraps a database callback in a transaction with SET LOCAL app.company_id.
 * This activates PostgreSQL RLS policies for the duration of the transaction.
 *
 * Usage:
 *   const result = await withTenantDb(req.ctx.companyId, db, (tx) =>
 *     tx.select().from(agents)
 *   )
 *
 * The application DB role must NOT have BYPASSRLS.
 * Migration runners should use a role WITH BYPASSRLS.
 */
export declare function withTenantDb<T>(companyId: string, db: Db, fn: (tx: Db) => Promise<T>): Promise<T>;
/**
 * Route-level guard. Call at the top of any handler that requires a resolved
 * company context. Returns false and sends 401/403 if ctx is missing.
 *
 * Usage:
 *   if (!requireCtx(req, res)) return
 */
export declare function requireCtx(req: Express.Request, res: import("express").Response): req is Express.Request & {
    ctx: RequestContext;
};
export declare function normaliseRole(raw: string | null | undefined): RequestContext["role"];
export declare function normalisePlan(raw: string | null | undefined): RequestContext["plan"];
//# sourceMappingURL=company-context.d.ts.map