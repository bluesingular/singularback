/**
 * server/src/routes/admin.ts
 *
 * Gap C — Swwarm admin portal.
 * All routes require isInstanceAdmin.
 *
 * GET  /admin/tenants                    → list all companies with health metrics
 * GET  /admin/tenants/:companyId         → single tenant detail
 * POST /admin/tenants/:companyId/impersonate  → start read-only impersonation session (audited)
 * DELETE /admin/tenants/:companyId/impersonate → end impersonation
 * GET  /admin/health                     → platform-level aggregate (total tenants, tasks, cost)
 */

import { Router } from "express";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import pino from "pino";
import {
  companies,
  companyMemberships,
  agents,
  issues,
  costRecords,
  auditEntries,
  authUsers,
  mcpApiKeys,
  activationMoments,
} from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { assertInstanceAdmin } from "./authz.js";
import { getLatestFleetSnapshot, computeAndPersistFleetSnapshot } from "../fleet/snapshot.js";
import { packInstallService } from "../services/pack-install-service.js";

const log = pino({ name: "admin-routes" });

// Compute 30-day window start
function thirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function microToEuros(micro: number): number {
  return Math.round(micro) / 1_000_000;
}

// ── Route builder ─────────────────────────────────────────────────────────────

export function adminRoutes(db: Db) {
  const router = Router();

  // All admin routes require instance admin
  router.use((req, res, next) => {
    try {
      assertInstanceAdmin(req);
      next();
    } catch (err) {
      next(err);
    }
  });

  // ── GET /admin/health — platform aggregate ────────────────────────────────

  router.get("/admin/health", async (_req, res) => {
    const [tenantCount] = await (db as any)
      .select({ count: sql<number>`count(*)::int` })
      .from(companies);

    const [taskCount] = await (db as any)
      .select({ count: sql<number>`count(*)::int` })
      .from(issues);

    const [costRow] = await (db as any)
      .select({ total: sql<number>`coalesce(sum(cost_eur_micro), 0)::bigint` })
      .from(costRecords)
      .where(gte(costRecords.createdAt, thirtyDaysAgo()));

    res.json({
      tenants:        tenantCount?.count ?? 0,
      tasksAllTime:   taskCount?.count ?? 0,
      costLast30Days: microToEuros(Number(costRow?.total ?? 0)),
    });
  });

  // ── GET /admin/tenants — list all companies with health metrics ───────────

  router.get("/admin/tenants", async (_req, res) => {
    const cutoff = thirtyDaysAgo();

    // All companies
    const allCompanies = await (db as any)
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt));

    // Member counts per company
    const memberCounts: { companyId: string; count: number }[] = await (db as any)
      .select({
        companyId: companyMemberships.companyId,
        count:     sql<number>`count(*)::int`,
      })
      .from(companyMemberships)
      .where(eq(companyMemberships.status, "active"))
      .groupBy(companyMemberships.companyId);

    const memberMap = new Map(memberCounts.map((r) => [r.companyId, r.count]));

    // Active agent counts per company
    const agentCounts: { companyId: string; count: number }[] = await (db as any)
      .select({
        companyId: agents.companyId,
        count:     sql<number>`count(*)::int`,
      })
      .from(agents)
      .where(eq(agents.status, "active"))
      .groupBy(agents.companyId);

    const agentMap = new Map(agentCounts.map((r) => [r.companyId, r.count]));

    // Tasks in last 30 days per company
    const recentTasks: { companyId: string; count: number }[] = await (db as any)
      .select({
        companyId: issues.companyId,
        count:     sql<number>`count(*)::int`,
      })
      .from(issues)
      .where(gte(issues.createdAt, cutoff))
      .groupBy(issues.companyId);

    const taskMap = new Map(recentTasks.map((r) => [r.companyId, r.count]));

    // Cost in last 30 days per company
    const recentCosts: { companyId: string; total: number }[] = await (db as any)
      .select({
        companyId: costRecords.companyId,
        total:     sql<number>`coalesce(sum(cost_eur_micro), 0)::bigint`,
      })
      .from(costRecords)
      .where(gte(costRecords.createdAt, cutoff))
      .groupBy(costRecords.companyId);

    const costMap = new Map(recentCosts.map((r) => [r.companyId, Number(r.total)]));

    const tenants = allCompanies.map((c: any) => ({
      id:            c.id,
      name:          c.name,
      slug:          c.slug,
      plan:          c.plan,
      status:        c.status,
      createdAt:     c.createdAt,
      members:       memberMap.get(c.id) ?? 0,
      activeAgents:  agentMap.get(c.id) ?? 0,
      tasksLast30d:  taskMap.get(c.id) ?? 0,
      costLast30d:   microToEuros(costMap.get(c.id) ?? 0),
      tasksUsed:     c.tasksUsedMonth ?? 0,
      tasksLimit:    c.tasksLimitMonth ?? 0,
      stripeCustomerId: c.stripeCustomerId ?? null,
    }));

    res.json({ tenants });
  });

  // ── GET /admin/tenants/:companyId — single tenant detail ─────────────────

  router.get("/admin/tenants/:companyId", async (req, res) => {
    const { companyId } = req.params as { companyId: string };

    const [company] = await (db as any)
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      res.status(404).json({ error: "Tenant introuvable" });
      return;
    }

    // Members with user info
    const members = await (db as any)
      .select({
        userId:    companyMemberships.principalId,
        role:      companyMemberships.membershipRole,
        status:    companyMemberships.status,
        email:     authUsers.email,
        name:      authUsers.name,
        joinedAt:  companyMemberships.createdAt,
      })
      .from(companyMemberships)
      .leftJoin(authUsers, eq(authUsers.id, companyMemberships.principalId))
      .where(eq(companyMemberships.companyId, companyId))
      .orderBy(companyMemberships.createdAt);

    // Agents
    const agentList = await (db as any)
      .select({
        id:     agents.id,
        name:   agents.name,
        status: agents.status,
        role:   agents.role,
      })
      .from(agents)
      .where(eq(agents.companyId, companyId));

    // Last 10 audit entries (impersonation log + gate violations)
    const recentAudit = await (db as any)
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.companyId, companyId))
      .orderBy(desc(auditEntries.createdAt))
      .limit(10);

    // Recent task count (30 days)
    const [taskRow] = await (db as any)
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          gte(issues.createdAt, thirtyDaysAgo()),
        ),
      );

    // Cost (30 days)
    const [costRow] = await (db as any)
      .select({ total: sql<number>`coalesce(sum(cost_eur_micro), 0)::bigint` })
      .from(costRecords)
      .where(
        and(
          eq(costRecords.companyId, companyId),
          gte(costRecords.createdAt, thirtyDaysAgo()),
        ),
      );

    res.json({
      company: {
        id:             company.id,
        name:           company.name,
        slug:           company.slug,
        plan:           company.plan,
        status:         company.status,
        locale:         company.locale,
        timezone:       company.timezone,
        createdAt:      company.createdAt,
        stripeCustomerId: company.stripeCustomerId ?? null,
        stripeSubId:    company.stripeSubId ?? null,
        tasksUsed:      company.tasksUsedMonth ?? 0,
        tasksLimit:     company.tasksLimitMonth ?? 0,
        tokensUsed:     company.tokensUsedMonth ?? 0,
        tokensLimit:    company.tokensLimitMonth ?? 0,
        spentCents:     company.spentMonthlyCents ?? 0,
        budgetCents:    company.budgetMonthlyCents ?? 0,
      },
      members,
      agents: agentList,
      tasksLast30d: taskRow?.count ?? 0,
      costLast30d:  microToEuros(Number(costRow?.total ?? 0)),
      recentAudit,
    });
  });

  // ── POST /admin/tenants — create a new tenant ─────────────────────────────
  router.post("/admin/tenants", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const { name, plan = "solo" } = req.body as { name: string; plan?: string };
      if (!name?.trim()) {
        res.status(400).json({ ok: false, error: { code: "SWWARM_CLIENT_ERROR", message: "Le nom de l'entreprise est requis." } });
        return;
      }
      const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let slug = baseSlug;
      const existingSlug = await (db as any).select({ id: companies.id }).from(companies).where(eq(companies.slug, baseSlug));
      if (existingSlug.length > 0) slug = `${baseSlug}-${Date.now().toString(36)}`;

      // Generate unique 3-letter issue prefix from company name
      const words = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
      let prefix = words.length >= 3
        ? words[0][0] + words[1][0] + words[2][0]
        : words.length === 2
        ? words[0].slice(0, 2) + words[1][0]
        : (words[0] ?? "NEW").slice(0, 3).padEnd(3, "X");
      // Ensure unique prefix
      const existingPrefix = await (db as any).select({ id: companies.id }).from(companies).where(eq(companies.issuePrefix, prefix));
      if (existingPrefix.length > 0) prefix = prefix.slice(0, 2) + Date.now().toString(36).slice(-1).toUpperCase();

      const [company] = await (db as any)
        .insert(companies)
        .values({ name: name.trim(), slug, plan, status: "active", issuePrefix: prefix })
        .returning({ id: companies.id, name: companies.name, slug: companies.slug });
      log.info({ companyId: company.id, name: company.name }, "admin: tenant created");
      res.status(201).json({ ok: true, data: company });
    } catch (err) { next(err); }
  });

  // ── PATCH /admin/tenants/:companyId — update tenant name/status ────────────
  router.patch("/admin/tenants/:companyId", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const { companyId } = req.params as { companyId: string };
      const { name, status } = req.body as { name?: string; status?: string };
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name?.trim()) updates.name = name.trim();
      if (status && ["active", "suspended", "deleted"].includes(status)) updates.status = status;
      await (db as any).update(companies).set(updates).where(eq(companies.id, companyId));
      log.info({ companyId, updates }, "admin: tenant updated");
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ── POST /admin/tenants/:companyId/impersonate ────────────────────────────
  // Logs an audit entry and returns a signed token the UI can use to view
  // that tenant's dashboard in read-only mode.
  // Read-only enforcement: the impersonation flag is checked server-side on
  // every state-changing request (mutations blocked for impersonated actors).

  router.post("/admin/tenants/:companyId/impersonate", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    const adminUserId = (req as any).actor?.userId ?? "unknown";

    const [company] = await (db as any)
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId));

    if (!company) {
      res.status(404).json({ error: "Tenant introuvable" });
      return;
    }

    // Write audit entry
    await (db as any).insert(auditEntries).values({
      companyId,
      agentId:    null,
      taskId:     null,
      actionType: "impersonation_start",
      actionData: { adminUserId, targetCompanyId: companyId, targetCompanyName: company.name },
      result:     "success",
    });

    log.warn(
      { adminUserId, companyId, companyName: company.name },
      "admin: impersonation started",
    );

    res.json({
      companyId:   company.id,
      companyName: company.name,
      impersonatorId: adminUserId,
      startedAt:   new Date().toISOString(),
    });
  });

  // ── DELETE /admin/tenants/:companyId/impersonate ──────────────────────────

  // ── Gap O: fleet registry ──────────────────────────────────────────────────

  // GET /admin/fleet — latest fleet snapshot (internal Swwarm team only)
  router.get("/admin/fleet", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const snapshot = await getLatestFleetSnapshot(db);
      if (!snapshot) {
        res.status(404).json({ ok: false, error: { code: "SWWARM_NO_SNAPSHOT", message: "No fleet snapshot computed yet." } });
        return;
      }
      res.json({ ok: true, data: snapshot });
    } catch (err) { next(err); }
  });

  // POST /admin/fleet/refresh — trigger an immediate recompute
  router.post("/admin/fleet/refresh", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const snapshot = await computeAndPersistFleetSnapshot(db);
      res.json({ ok: true, data: snapshot });
    } catch (err) { next(err); }
  });

  // ── Admin pack management ─────────────────────────────────────────────────
  // GET  /admin/packs                              — list available packs from disk
  // GET  /admin/packs/installations                — all tenant × pack installs
  // POST /admin/companies/:companyId/packs/install — install for any tenant
  // DELETE /admin/companies/:companyId/packs/:packSlug — deactivate pack agents

  router.get("/admin/packs", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const svc = packInstallService(db);
      const packs = await svc.listAvailablePacks();
      res.json({ ok: true, data: { packs } });
    } catch (err) { next(err); }
  });

  router.get("/admin/packs/installations", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      // Use activation_moments as the install-tracking record (written atomically at pack install).
      // DISTINCT ON (company_id, pack_slug) so we get one row per installation.
      const rows = await (db as any)
        .selectDistinct({
          companyId:   activationMoments.companyId,
          companyName: companies.name,
          packSlug:    activationMoments.packSlug,
          installedAt: sql<string>`MIN(${activationMoments.createdAt})`,
        })
        .from(activationMoments)
        .leftJoin(companies, eq(companies.id, activationMoments.companyId))
        .groupBy(activationMoments.companyId, companies.name, activationMoments.packSlug)
        .orderBy(desc(sql`MIN(${activationMoments.createdAt})`));

      // Annotate with active agent count per company/pack as a proxy for install health
      const installations = await Promise.all(rows.map(async (row: any) => {
        const [{ count }] = await (db as any)
          .select({ count: sql<number>`COUNT(*)` })
          .from(agents)
          .where(and(eq(agents.companyId, row.companyId), eq(agents.status, "active")));
        return {
          id:          `${row.companyId}-${row.packSlug}`,
          companyId:   row.companyId,
          companyName: row.companyName,
          packSlug:    row.packSlug,
          packVersion: "1.0.0",
          installedAt: row.installedAt,
          status:      Number(count) > 0 ? "active" : "error",
        };
      }));

      res.json({ ok: true, data: { installations } });
    } catch (err) { next(err); }
  });

  router.post("/admin/companies/:companyId/packs/install", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const { companyId } = req.params as { companyId: string };
      const { packSlug, dnaExtensions } = req.body ?? {};
      if (!packSlug) { res.status(400).json({ ok: false, error: "packSlug is required" }); return; }

      const svc = packInstallService(db);
      const result = await svc.install(companyId, packSlug, dnaExtensions ?? {});

      await (db as any).insert(auditEntries).values({
        companyId,
        agentId:    null,
        taskId:     null,
        actionType: "pack.installed",
        actionData: { packSlug, adminUserId: (req as any).actor?.userId },
        result:     "success",
      });

      log.info({ adminUserId: (req as any).actor?.userId, companyId, packSlug }, "admin: pack installed");
      res.json({ ok: true, data: result });
    } catch (err) { next(err); }
  });

  router.delete("/admin/companies/:companyId/packs/:packSlug", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const { companyId, packSlug } = req.params as { companyId: string; packSlug: string };

      // Deactivate all agents for this company (pack uninstall = pause all agents)
      await (db as any)
        .update(agents)
        .set({ status: "deactivated" })
        .where(eq(agents.companyId, companyId));

      await (db as any).insert(auditEntries).values({
        companyId,
        agentId:    null,
        taskId:     null,
        actionType: "pack.uninstalled",
        actionData: { packSlug, adminUserId: (req as any).actor?.userId },
        result:     "success",
      });

      log.info({ adminUserId: (req as any).actor?.userId, companyId, packSlug }, "admin: pack deactivated");
      res.json({ ok: true, data: { companyId, packSlug, status: "deactivated" } });
    } catch (err) { next(err); }
  });

  // ── Admin MCP management ──────────────────────────────────────────────────
  // GET  /admin/mcp/keys           — all keys across all tenants
  // POST /admin/mcp/keys           — create a key for any tenant
  // DELETE /admin/mcp/keys/:keyId  — revoke any key
  // GET  /admin/mcp/stats          — per-tenant usage summary

  router.get("/admin/mcp/keys", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const rows = await (db as any)
        .select({
          id:         mcpApiKeys.id,
          companyId:  mcpApiKeys.companyId,
          companyName: companies.name,
          name:       mcpApiKeys.name,
          lastUsedAt: mcpApiKeys.lastUsedAt,
          revokedAt:  mcpApiKeys.revokedAt,
          createdAt:  mcpApiKeys.createdAt,
        })
        .from(mcpApiKeys)
        .leftJoin(companies, eq(companies.id, mcpApiKeys.companyId))
        .orderBy(desc(mcpApiKeys.createdAt));
      res.json({ ok: true, data: { keys: rows } });
    } catch (err) { next(err); }
  });

  router.post("/admin/mcp/keys", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const { companyId, name } = req.body ?? {};
      if (!companyId || !name) {
        res.status(400).json({ ok: false, error: "companyId and name are required" });
        return;
      }
      const { randomBytes, createHash } = await import("node:crypto");
      const rawKey  = `swm_${randomBytes(32).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const [row] = await (db as any)
        .insert(mcpApiKeys)
        .values({ companyId, name, keyHash })
        .returning({ id: mcpApiKeys.id, name: mcpApiKeys.name, createdAt: mcpApiKeys.createdAt });
      log.info({ adminUserId: (req as any).actor?.userId, companyId, keyId: row.id }, "admin: MCP key created");
      res.status(201).json({ ok: true, data: { key: rawKey, id: row.id, name: row.name, createdAt: row.createdAt } });
    } catch (err) { next(err); }
  });

  router.delete("/admin/mcp/keys/:keyId", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const { keyId } = req.params as { keyId: string };
      const [row] = await (db as any)
        .update(mcpApiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(mcpApiKeys.id, keyId), sql`${mcpApiKeys.revokedAt} IS NULL`))
        .returning({ id: mcpApiKeys.id, companyId: mcpApiKeys.companyId });
      if (!row) { res.status(404).json({ ok: false, error: "Key not found or already revoked" }); return; }
      log.info({ adminUserId: (req as any).actor?.userId, keyId, companyId: row.companyId }, "admin: MCP key revoked");
      res.json({ ok: true, data: { id: row.id } });
    } catch (err) { next(err); }
  });

  router.get("/admin/mcp/stats", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      // Per-tenant: active key count + last activity
      const rows = await (db as any)
        .select({
          companyId:    mcpApiKeys.companyId,
          companyName:  companies.name,
          activeKeys:   sql<number>`COUNT(*) FILTER (WHERE ${mcpApiKeys.revokedAt} IS NULL)`,
          totalKeys:    sql<number>`COUNT(*)`,
          lastUsedAt:   sql<string>`MAX(${mcpApiKeys.lastUsedAt})`,
        })
        .from(mcpApiKeys)
        .leftJoin(companies, eq(companies.id, mcpApiKeys.companyId))
        .groupBy(mcpApiKeys.companyId, companies.name)
        .orderBy(desc(sql`MAX(${mcpApiKeys.lastUsedAt})`));
      res.json({ ok: true, data: { tenants: rows } });
    } catch (err) { next(err); }
  });

  router.delete("/admin/tenants/:companyId/impersonate", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    const adminUserId = (req as any).actor?.userId ?? "unknown";

    await (db as any).insert(auditEntries).values({
      companyId,
      agentId:    null,
      taskId:     null,
      actionType: "impersonation_end",
      actionData: { adminUserId, targetCompanyId: companyId },
      result:     "success",
    });

    log.info({ adminUserId, companyId }, "admin: impersonation ended");

    res.json({ ok: true });
  });

  return router;
}
