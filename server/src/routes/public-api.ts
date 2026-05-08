/**
 * G13 — Public API routes (v1) + API key management.
 *
 * Public API (Bearer auth via publicApiAuth middleware):
 *   GET    /api/v1/openapi.json                    — no auth
 *   GET    /api/v1/agents                          — list agents
 *   GET    /api/v1/agents/:id                      — get agent
 *   GET    /api/v1/tasks                           — list tasks (filter: status, agentId, limit, offset)
 *   GET    /api/v1/tasks/:id                       — get task
 *   POST   /api/v1/tasks                           — create task (read_write scope only)
 *   GET    /api/v1/webhooks/subscriptions          — list subscriptions
 *   POST   /api/v1/webhooks/subscriptions          — create subscription (read_write only)
 *   DELETE /api/v1/webhooks/subscriptions/:id      — delete subscription (read_write only)
 *
 * Key management (session auth, operator+):
 *   POST   /companies/:companyId/public-api/keys   — create key (returns raw key once)
 *   GET    /companies/:companyId/public-api/keys   — list keys
 *   DELETE /companies/:companyId/public-api/keys/:keyId — revoke key
 */

import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { publicApiKeys, webhookSubscriptions, agents, issues } from "@paperclipai/db";
import { and, eq, isNull, desc } from "drizzle-orm";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { notFound, badRequest, forbidden } from "../errors.js";
import { publicApiAuth, hashApiKey } from "../middleware/public-api-auth.js";
import { buildOpenApiSpec } from "../api/openapi.js";

function hashKey(raw: string): string {
  return hashApiKey(raw);
}

export function publicApiRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });

  // ── Public API — no auth ───────────────────────────────────────────────────

  router.get("/api/v1/openapi.json", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json(buildOpenApiSpec(baseUrl));
  });

  // ── Public API — Bearer auth ───────────────────────────────────────────────

  const v1 = Router();
  v1.use(publicApiAuth(db));

  // GET /api/v1/agents
  v1.get("/agents", async (req, res, next) => {
    try {
      const companyId = req.publicApiCompanyId!;
      const rows = await (db as any)
        .select({
          id:          agents.id,
          name:        agents.name,
          description: agents.description,
          icon:        agents.icon,
          isActive:    agents.isActive,
          createdAt:   agents.createdAt,
        })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .orderBy(desc(agents.createdAt));

      res.json({ agents: rows });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/agents/:id
  v1.get("/agents/:id", async (req, res, next) => {
    try {
      const companyId = req.publicApiCompanyId!;
      const [row] = await (db as any)
        .select({
          id:          agents.id,
          name:        agents.name,
          description: agents.description,
          icon:        agents.icon,
          isActive:    agents.isActive,
          createdAt:   agents.createdAt,
        })
        .from(agents)
        .where(and(eq(agents.id, req.params.id), eq(agents.companyId, companyId)));

      if (!row) throw notFound("Agent not found");
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/tasks
  v1.get("/tasks", async (req, res, next) => {
    try {
      const companyId = req.publicApiCompanyId!;
      const limit  = Math.min(parseInt(String(req.query.limit  ?? "50"),  10), 200);
      const offset = Math.max(parseInt(String(req.query.offset ?? "0"),   10), 0);
      const status  = req.query.status  as string | undefined;
      const agentId = req.query.agentId as string | undefined;

      const conditions: any[] = [eq(issues.companyId, companyId)];
      if (status)  conditions.push(eq(issues.status,  status));
      if (agentId) conditions.push(eq(issues.agentId, agentId));

      const rows = await (db as any)
        .select({
          id:        issues.id,
          title:     issues.title,
          status:    issues.status,
          agentId:   issues.agentId,
          createdAt: issues.createdAt,
          updatedAt: issues.updatedAt,
        })
        .from(issues)
        .where(and(...conditions))
        .orderBy(desc(issues.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({ tasks: rows, total: rows.length });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/tasks/:id
  v1.get("/tasks/:id", async (req, res, next) => {
    try {
      const companyId = req.publicApiCompanyId!;
      const [row] = await (db as any)
        .select({
          id:        issues.id,
          title:     issues.title,
          status:    issues.status,
          agentId:   issues.agentId,
          createdAt: issues.createdAt,
          updatedAt: issues.updatedAt,
        })
        .from(issues)
        .where(and(eq(issues.id, req.params.id), eq(issues.companyId, companyId)));

      if (!row) throw notFound("Task not found");
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/tasks (read_write scope only)
  v1.post("/tasks", async (req, res, next) => {
    try {
      if (req.publicApiScope === "read") {
        throw forbidden("This API key has read-only scope");
      }

      const { title, description, agentId } = req.body ?? {};
      if (!title || typeof title !== "string") throw badRequest("title is required");

      const companyId = req.publicApiCompanyId!;
      const [row] = await (db as any)
        .insert(issues)
        .values({
          id:          randomUUID(),
          companyId,
          title:       title.trim().slice(0, 500),
          description: description ?? null,
          agentId:     agentId ?? null,
          status:      "open",
          originKind:  "public_api",
        })
        .returning({
          id:        issues.id,
          title:     issues.title,
          status:    issues.status,
          agentId:   issues.agentId,
          createdAt: issues.createdAt,
          updatedAt: issues.updatedAt,
        });

      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/v1/webhooks/subscriptions
  v1.get("/webhooks/subscriptions", async (req, res, next) => {
    try {
      const companyId = req.publicApiCompanyId!;
      const rows = await (db as any)
        .select({
          id:        webhookSubscriptions.id,
          url:       webhookSubscriptions.url,
          events:    webhookSubscriptions.events,
          active:    webhookSubscriptions.active,
          createdAt: webhookSubscriptions.createdAt,
        })
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.companyId, companyId))
        .orderBy(desc(webhookSubscriptions.createdAt));

      res.json({ subscriptions: rows });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/v1/webhooks/subscriptions (read_write scope only)
  v1.post("/webhooks/subscriptions", async (req, res, next) => {
    try {
      if (req.publicApiScope === "read") {
        throw forbidden("This API key has read-only scope");
      }

      const { url, events } = req.body ?? {};
      if (!url || typeof url !== "string") throw badRequest("url is required");
      if (!Array.isArray(events))           throw badRequest("events must be an array");

      // Basic URL validation
      try { new URL(url); } catch { throw badRequest("url must be a valid URL"); }

      const companyId = req.publicApiCompanyId!;
      const signingSecret = randomBytes(32).toString("hex");

      const [row] = await (db as any)
        .insert(webhookSubscriptions)
        .values({
          companyId,
          url,
          events,
          signingSecret,
          active: true,
        })
        .returning({
          id:        webhookSubscriptions.id,
          url:       webhookSubscriptions.url,
          events:    webhookSubscriptions.events,
          active:    webhookSubscriptions.active,
          createdAt: webhookSubscriptions.createdAt,
        });

      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/v1/webhooks/subscriptions/:id (read_write scope only)
  v1.delete("/webhooks/subscriptions/:id", async (req, res, next) => {
    try {
      if (req.publicApiScope === "read") {
        throw forbidden("This API key has read-only scope");
      }

      const companyId = req.publicApiCompanyId!;
      const [row] = await (db as any)
        .delete(webhookSubscriptions)
        .where(
          and(
            eq(webhookSubscriptions.id, req.params.id),
            eq(webhookSubscriptions.companyId, companyId),
          ),
        )
        .returning({ id: webhookSubscriptions.id });

      if (!row) throw notFound("Webhook subscription not found");
      res.json({ ok: true, id: row.id });
    } catch (err) {
      next(err);
    }
  });

  router.use("/api/v1", v1);

  // ── Key management (session auth, operator+) ───────────────────────────────

  router.post("/companies/:companyId/public-api/keys", async (req, res, next) => {
    try {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const { name, scope = "read_write" } = req.body ?? {};
      if (!name || typeof name !== "string") throw badRequest("name is required");
      if (!["read", "read_write"].includes(scope)) throw badRequest("scope must be 'read' or 'read_write'");

      const rawKey = `spk_${randomBytes(32).toString("hex")}`;
      const keyHash = hashKey(rawKey);

      const [row] = await (db as any)
        .insert(publicApiKeys)
        .values({
          companyId,
          name,
          keyHash,
          scope,
          createdByUserId: (req as any).actor?.userId ?? null,
        })
        .returning({
          id:        publicApiKeys.id,
          name:      publicApiKeys.name,
          scope:     publicApiKeys.scope,
          createdAt: publicApiKeys.createdAt,
        });

      res.status(201).json({ ok: true, key: rawKey, id: row.id, name: row.name, scope: row.scope, createdAt: row.createdAt });
    } catch (err) {
      next(err);
    }
  });

  router.get("/companies/:companyId/public-api/keys", async (req, res, next) => {
    try {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const rows = await (db as any)
        .select({
          id:               publicApiKeys.id,
          name:             publicApiKeys.name,
          scope:            publicApiKeys.scope,
          rateLimitPerHour: publicApiKeys.rateLimitPerHour,
          lastUsedAt:       publicApiKeys.lastUsedAt,
          revokedAt:        publicApiKeys.revokedAt,
          createdAt:        publicApiKeys.createdAt,
        })
        .from(publicApiKeys)
        .where(eq(publicApiKeys.companyId, companyId))
        .orderBy(desc(publicApiKeys.createdAt));

      res.json({ keys: rows });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/companies/:companyId/public-api/keys/:keyId", async (req, res, next) => {
    try {
      const { companyId, keyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const [row] = await (db as any)
        .update(publicApiKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(publicApiKeys.id, keyId),
            eq(publicApiKeys.companyId, companyId),
            isNull(publicApiKeys.revokedAt),
          ),
        )
        .returning({ id: publicApiKeys.id });

      if (!row) throw notFound("API key not found or already revoked");
      res.json({ ok: true, id: row.id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
