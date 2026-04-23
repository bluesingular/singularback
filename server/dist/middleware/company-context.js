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
import { sql, eq, and } from "drizzle-orm";
import { companies, companyMemberships } from "@paperclipai/db";
import { logger } from "./logger.js";
// ── Middleware ────────────────────────────────────────────────────────────────
export function companyContextMiddleware(db) {
    return async (req, res, next) => {
        try {
            const actor = req.actor;
            // Unauthenticated — skip; routes that require a company use requireCtx()
            if (actor.type === "none") {
                next();
                return;
            }
            // Agent actors already carry a single companyId from the JWT/key
            if (actor.type === "agent") {
                const companyId = actor.companyId;
                if (!companyId) {
                    next();
                    return;
                }
                const company = await fetchCompany(db, companyId);
                if (!company) {
                    next();
                    return;
                }
                req.ctx = {
                    userId: actor.agentId ?? "agent",
                    companyId,
                    role: "manager", // agents act with manager-level scope
                    plan: normalisePlan(company.plan),
                };
                next();
                return;
            }
            // Board (human) actor — resolve active company
            const userId = actor.userId;
            if (!userId) {
                next();
                return;
            }
            // 1. Prefer explicit header (React app sets this after switcher call)
            const headerCompanyId = req.header("x-singular-company-id");
            // 2. Fall back to first active membership
            const memberships = await db
                .select({
                companyId: companyMemberships.companyId,
                role: companyMemberships.membershipRole,
            })
                .from(companyMemberships)
                .where(and(eq(companyMemberships.principalType, "user"), eq(companyMemberships.principalId, userId), eq(companyMemberships.status, "active")));
            if (memberships.length === 0) {
                // User exists but belongs to no company yet — ctx left unset
                next();
                return;
            }
            let membership = memberships[0];
            if (headerCompanyId) {
                const match = memberships.find((m) => m.companyId === headerCompanyId);
                if (!match) {
                    // User is not a member of the requested company — 403
                    res.status(403).json({ error: "Accès refusé à cette entreprise." });
                    return;
                }
                membership = match;
            }
            const company = await fetchCompany(db, membership.companyId);
            if (!company) {
                next();
                return;
            }
            req.ctx = {
                userId,
                companyId: membership.companyId,
                role: normaliseRole(membership.role),
                plan: normalisePlan(company.plan),
            };
            next();
        }
        catch (err) {
            logger.error({ err }, "companyContextMiddleware: unexpected error");
            next(err);
        }
    };
}
// ── withTenantDb ──────────────────────────────────────────────────────────────
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
export async function withTenantDb(companyId, db, fn) {
    return db.transaction(async (tx) => {
        await tx.execute(sql `SET LOCAL app.company_id = ${companyId}`);
        return fn(tx);
    });
}
// ── requireCtx ───────────────────────────────────────────────────────────────
/**
 * Route-level guard. Call at the top of any handler that requires a resolved
 * company context. Returns false and sends 401/403 if ctx is missing.
 *
 * Usage:
 *   if (!requireCtx(req, res)) return
 */
export function requireCtx(req, res) {
    if (!req.actor || req.actor.type === "none") {
        res.status(401).json({ error: "Authentification requise." });
        return false;
    }
    if (!req.ctx) {
        res.status(403).json({ error: "Aucune entreprise active pour ce compte." });
        return false;
    }
    return true;
}
// ── Helpers ───────────────────────────────────────────────────────────────────
export function normaliseRole(raw) {
    if (raw === "owner" || raw === "admin" || raw === "manager" || raw === "viewer")
        return raw;
    return "viewer";
}
export function normalisePlan(raw) {
    if (raw === "solo" || raw === "growth" || raw === "pro" || raw === "enterprise")
        return raw;
    return "growth";
}
async function fetchCompany(db, companyId) {
    return db
        .select({ id: companies.id, plan: companies.plan, status: companies.status })
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);
}
//# sourceMappingURL=company-context.js.map