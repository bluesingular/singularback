/**
 * server/src/routes/quality-gates.ts
 *
 * Quality gate CRUD for a company.
 *
 * GET    /companies/:companyId/quality-gates              → list gates
 * POST   /companies/:companyId/quality-gates              → create gate
 * PATCH  /companies/:companyId/quality-gates/:id          → update gate
 * DELETE /companies/:companyId/quality-gates/:id          → delete gate
 * GET    /companies/:companyId/quality-gates/violations   → recent violations
 */

import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { qualityGates, gateViolations } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { assertCompanyAccess, requireRole } from "./authz.js";

const GATE_TYPES = ["volume_limit", "recipient_whitelist", "budget_limit", "content_forbidden"] as const;
type GateType = (typeof GATE_TYPES)[number];

const GateConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("volume_limit"),
    maxPerDay: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("recipient_whitelist"),
    allowedDomains: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("budget_limit"),
    limitCents: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("content_forbidden"),
    terms: z.array(z.string()).min(1),
  }),
]);

const CreateGateSchema = z.object({
  gateType: z.enum(GATE_TYPES),
  agentId:  z.string().uuid().nullable().optional(),
  config:   GateConfigSchema,
  enabled:  z.boolean().optional().default(true),
});

const UpdateGateSchema = z.object({
  config:  GateConfigSchema.optional(),
  enabled: z.boolean().optional(),
  agentId: z.string().uuid().nullable().optional(),
});

export function qualityGateRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/quality-gates/violations  (must be before /:id)
  router.get("/companies/:companyId/quality-gates/violations", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select()
      .from(gateViolations)
      .where(eq(gateViolations.companyId, companyId))
      .orderBy(desc(gateViolations.createdAt))
      .limit(100);

    res.json(rows);
  });

  // GET /companies/:companyId/quality-gates
  router.get("/companies/:companyId/quality-gates", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select()
      .from(qualityGates)
      .where(eq(qualityGates.companyId, companyId))
      .orderBy(qualityGates.createdAt);

    res.json(rows);
  });

  // POST /companies/:companyId/quality-gates
  router.post("/companies/:companyId/quality-gates", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const parsed = CreateGateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid gate", details: parsed.error.flatten() });
      return;
    }

    const { gateType, agentId, config, enabled } = parsed.data;
    const { type: _type, ...configData } = config;

    const [gate] = await db
      .insert(qualityGates)
      .values({
        companyId,
        agentId:  agentId ?? null,
        gateType,
        config:   configData as Record<string, unknown>,
        enabled:  enabled ?? true,
      })
      .returning();

    res.status(201).json(gate);
  });

  // PATCH /companies/:companyId/quality-gates/:id
  router.patch("/companies/:companyId/quality-gates/:id", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const parsed = UpdateGateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
    if (parsed.data.agentId !== undefined) updates.agentId = parsed.data.agentId;
    if (parsed.data.config !== undefined) {
      const { type: _type, ...configData } = parsed.data.config;
      updates.config = configData;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [gate] = await db
      .update(qualityGates)
      .set(updates as any)
      .where(and(eq(qualityGates.id, id), eq(qualityGates.companyId, companyId)))
      .returning();

    if (!gate) {
      res.status(404).json({ error: "Gate not found" });
      return;
    }

    res.json(gate);
  });

  // DELETE /companies/:companyId/quality-gates/:id
  router.delete("/companies/:companyId/quality-gates/:id", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const [deleted] = await db
      .delete(qualityGates)
      .where(and(eq(qualityGates.id, id), eq(qualityGates.companyId, companyId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Gate not found" });
      return;
    }

    res.status(204).send();
  });

  return router;
}
