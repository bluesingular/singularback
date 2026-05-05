/**
 * server/src/routes/webhook-endpoints.ts
 *
 * Webhook endpoint management — G4.
 *
 * GET    /companies/:companyId/webhook-endpoints          → list all endpoints
 * POST   /companies/:companyId/webhook-endpoints          → create endpoint
 * PATCH  /companies/:companyId/webhook-endpoints/:id      → update endpoint
 * DELETE /companies/:companyId/webhook-endpoints/:id      → deactivate endpoint
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { webhookEndpoints } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { assertCompanyAccess, requireRole } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "webhook-endpoint-routes" });

const RoutingRuleSchema = z.object({
  condition: z
    .object({
      field: z.string(),
      op: z.enum(["eq", "contains", "exists"]),
      value: z.string().optional(),
    })
    .optional(),
  action: z.object({
    type: z.enum(["heartbeat", "log_only"]),
    agentId: z.string().uuid().optional(),
  }),
});

const CreateEndpointSchema = z.object({
  name: z.string().min(1).max(100),
  secret: z.string().min(8).optional(),
  sourceHint: z
    .enum(["indeed", "calendly", "slack", "github", "stripe", "custom"])
    .optional()
    .default("custom"),
  routingRules: z.array(RoutingRuleSchema).default([]),
});

const UpdateEndpointSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  secret: z.string().min(8).nullable().optional(),
  sourceHint: z
    .enum(["indeed", "calendly", "slack", "github", "stripe", "custom"])
    .optional(),
  routingRules: z.array(RoutingRuleSchema).optional(),
  isActive: z.boolean().optional(),
});

export function webhookEndpointRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/webhook-endpoints
  router.get("/companies/:companyId/webhook-endpoints", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.companyId, companyId));

    res.json(rows);
  });

  // POST /companies/:companyId/webhook-endpoints
  router.post("/companies/:companyId/webhook-endpoints", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const parsed = CreateEndpointSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { name, secret, sourceHint, routingRules } = parsed.data;

    const [endpoint] = await db
      .insert(webhookEndpoints)
      .values({
        companyId,
        name,
        secret: secret ?? null,
        sourceHint: sourceHint ?? "custom",
        routingRules: routingRules as Record<string, unknown>[],
        isActive: true,
      })
      .returning();

    logger.info({ companyId, endpointId: endpoint.id, name }, "webhook endpoint created");
    res.status(201).json(endpoint);
  });

  // PATCH /companies/:companyId/webhook-endpoints/:id
  router.patch("/companies/:companyId/webhook-endpoints/:id", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const parsed = UpdateEndpointSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const updates: Partial<typeof parsed.data> = {};
    const data = parsed.data;
    if (data.name !== undefined) (updates as any).name = data.name;
    if (data.secret !== undefined) (updates as any).secret = data.secret;
    if (data.sourceHint !== undefined) (updates as any).sourceHint = data.sourceHint;
    if (data.routingRules !== undefined) (updates as any).routingRules = data.routingRules;
    if (data.isActive !== undefined) (updates as any).isActive = data.isActive;
    (updates as any).updatedAt = new Date();

    const [endpoint] = await db
      .update(webhookEndpoints)
      .set(updates as any)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.companyId, companyId)))
      .returning();

    if (!endpoint) {
      res.status(404).json({ error: "Endpoint not found" });
      return;
    }

    logger.info({ companyId, endpointId: id }, "webhook endpoint updated");
    res.json(endpoint);
  });

  // DELETE /companies/:companyId/webhook-endpoints/:id
  // Soft-delete: sets isActive = false
  router.delete("/companies/:companyId/webhook-endpoints/:id", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const [endpoint] = await db
      .update(webhookEndpoints)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.companyId, companyId)))
      .returning();

    if (!endpoint) {
      res.status(404).json({ error: "Endpoint not found" });
      return;
    }

    logger.info({ companyId, endpointId: id }, "webhook endpoint deactivated");
    res.status(204).send();
  });

  return router;
}
