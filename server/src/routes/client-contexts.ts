/**
 * server/src/routes/client-contexts.ts
 *
 * §35 Client Context Architecture.
 *
 * GET    /companies/:companyId/client-contexts              list contexts
 * POST   /companies/:companyId/client-contexts              create context
 * GET    /companies/:companyId/client-contexts/:ctxId       get context
 * PATCH  /companies/:companyId/client-contexts/:ctxId       update DNA / status
 * DELETE /companies/:companyId/client-contexts/:ctxId       archive (GDPR cascade)
 *
 * GET    /companies/:companyId/client-contexts/:ctxId/missions   missions scoped to context
 * GET    /companies/:companyId/client-contexts/:ctxId/memory     memory scoped to context
 *
 * Overlays:
 * GET    /companies/:companyId/client-contexts/:ctxId/overlays          list
 * PUT    /companies/:companyId/client-contexts/:ctxId/overlays/:skillId upsert
 *
 * ISOLATION INVARIANT (§35.2):
 *   Every query on org_memory, tasks, missions, goals MUST include client_context_id
 *   in the WHERE clause. A query scoped to context A NEVER returns context B data.
 *   Enforced at DB query level in EVERY route handler — not just application logic.
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, isNull, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  clientContexts,
  clientSkillOverlays,
  missions,
  memoryEntries,
} from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "client-contexts" });

const createContextSchema = z.object({
  name:      z.string().min(1).max(200),
  slug:      z.string().regex(/^[a-z0-9-]+$/).min(1).max(100),
  clientDna: z.record(z.unknown()).optional().default({}),
});

const updateContextSchema = z.object({
  name:      z.string().min(1).max(200).optional(),
  clientDna: z.record(z.unknown()).optional(),
  status:    z.enum(["active", "paused", "archived"]).optional(),
});

const overlaySchema = z.object({
  additionalSoulInstructions:  z.string().max(500).optional(),
  qualityThresholdAdjustment:  z.number().min(-1).max(1).optional(),
  preferredToneOverride:       z.enum(["formal", "balanced", "casual"]).optional(),
  sectorVocabulary:            z.array(z.string()).optional(),
});

export function clientContextRoutes(db: Db): Router {
  const router = Router();

  // ── Context CRUD ─────────────────────────────────────────────────────────

  // GET /companies/:companyId/client-contexts
  router.get("/companies/:companyId/client-contexts", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const rows = await (db as any)
      .select()
      .from(clientContexts)
      .where(eq(clientContexts.companyId, companyId))
      .orderBy(desc(clientContexts.createdAt));

    res.json({ ok: true, contexts: rows });
  });

  // POST /companies/:companyId/client-contexts
  router.post("/companies/:companyId/client-contexts", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const body = createContextSchema.parse(req.body);

    const [ctx] = await (db as any)
      .insert(clientContexts)
      .values({ companyId, ...body })
      .returning({ id: clientContexts.id, slug: clientContexts.slug });

    logger.info({ companyId, ctxId: ctx.id, slug: ctx.slug }, "client-contexts: created");
    res.status(201).json({ ok: true, id: ctx.id, slug: ctx.slug });
  });

  // GET /companies/:companyId/client-contexts/:ctxId
  router.get("/companies/:companyId/client-contexts/:ctxId", async (req, res) => {
    const { companyId, ctxId } = req.params as { companyId: string; ctxId: string };
    assertCompanyAccess(req, companyId);

    const [ctx] = await (db as any)
      .select()
      .from(clientContexts)
      .where(and(eq(clientContexts.id, ctxId), eq(clientContexts.companyId, companyId)))
      .limit(1);

    if (!ctx) { res.status(404).json({ error: "Client context not found" }); return; }
    res.json({ ok: true, context: ctx });
  });

  // PATCH /companies/:companyId/client-contexts/:ctxId
  router.patch("/companies/:companyId/client-contexts/:ctxId", async (req, res) => {
    const { companyId, ctxId } = req.params as { companyId: string; ctxId: string };
    assertCompanyAccess(req, companyId);

    const body = updateContextSchema.parse(req.body);
    const updates: Record<string, unknown> = {};
    if (body.name)      updates.name      = body.name;
    if (body.clientDna) updates.clientDna = JSON.stringify(body.clientDna);
    if (body.status)    updates.status    = body.status;

    await (db as any)
      .update(clientContexts)
      .set(updates)
      .where(and(eq(clientContexts.id, ctxId), eq(clientContexts.companyId, companyId)));

    res.json({ ok: true });
  });

  // DELETE /companies/:companyId/client-contexts/:ctxId
  // GDPR: cascades to org_memory, tasks, missions, goals (via ON DELETE CASCADE)
  router.delete("/companies/:companyId/client-contexts/:ctxId", async (req, res) => {
    const { companyId, ctxId } = req.params as { companyId: string; ctxId: string };
    assertCompanyAccess(req, companyId);

    const [deleted] = await (db as any)
      .delete(clientContexts)
      .where(and(eq(clientContexts.id, ctxId), eq(clientContexts.companyId, companyId)))
      .returning({ id: clientContexts.id });

    if (!deleted) { res.status(404).json({ error: "Client context not found" }); return; }

    logger.info({ companyId, ctxId }, "client-contexts: deleted (GDPR cascade)");
    res.json({ ok: true });
  });

  // ── Scoped data — ISOLATION INVARIANT enforced below ─────────────────────

  // GET /companies/:companyId/client-contexts/:ctxId/missions
  // INVARIANT: WHERE clause ALWAYS includes client_context_id = ctxId
  router.get("/companies/:companyId/client-contexts/:ctxId/missions", async (req, res) => {
    const { companyId, ctxId } = req.params as { companyId: string; ctxId: string };
    assertCompanyAccess(req, companyId);

    // ISOLATION: explicit ctxId filter — never returns other context's missions
    const rows = await (db as any)
      .select({
        id:        missions.id,
        title:     missions.title,
        status:    missions.status,
        createdAt: missions.createdAt,
      })
      .from(missions)
      .where(and(
        eq(missions.companyId, companyId),
        eq((missions as any).clientContextId, ctxId),  // ISOLATION INVARIANT
      ))
      .orderBy(desc(missions.createdAt));

    res.json({ ok: true, missions: rows });
  });

  // GET /companies/:companyId/client-contexts/:ctxId/memory
  // INVARIANT: WHERE clause ALWAYS includes client_context_id = ctxId
  router.get("/companies/:companyId/client-contexts/:ctxId/memory", async (req, res) => {
    const { companyId, ctxId } = req.params as { companyId: string; ctxId: string };
    assertCompanyAccess(req, companyId);

    const limit = Math.min(Number(req.query.limit ?? 20), 100);

    // ISOLATION: explicit ctxId filter — NEVER returns firm-level or other-client memory
    const rows = await (db as any)
      .select({
        id:        memoryEntries.id,
        content:   memoryEntries.content,
        source:    (memoryEntries as any).source,
        createdAt: memoryEntries.createdAt,
      })
      .from(memoryEntries)
      .where(and(
        eq(memoryEntries.companyId, companyId),
        eq((memoryEntries as any).clientContextId, ctxId),  // ISOLATION INVARIANT
      ))
      .orderBy(desc(memoryEntries.createdAt))
      .limit(limit);

    res.json({ ok: true, memory: rows });
  });

  // ── Skill overlays ────────────────────────────────────────────────────────

  // GET /companies/:companyId/client-contexts/:ctxId/overlays
  router.get("/companies/:companyId/client-contexts/:ctxId/overlays", async (req, res) => {
    const { companyId, ctxId } = req.params as { companyId: string; ctxId: string };
    assertCompanyAccess(req, companyId);

    const rows = await (db as any)
      .select()
      .from(clientSkillOverlays)
      .where(and(
        eq(clientSkillOverlays.companyId, companyId),
        eq(clientSkillOverlays.clientContextId, ctxId),
      ));

    res.json({ ok: true, overlays: rows });
  });

  // PUT /companies/:companyId/client-contexts/:ctxId/overlays/:skillId
  router.put("/companies/:companyId/client-contexts/:ctxId/overlays/:skillId", async (req, res) => {
    const { companyId, ctxId, skillId } = req.params as {
      companyId: string; ctxId: string; skillId: string;
    };
    assertCompanyAccess(req, companyId);

    const body = overlaySchema.parse(req.body);

    await (db as any)
      .insert(clientSkillOverlays)
      .values({ companyId, clientContextId: ctxId, skillId, ...body })
      .onConflictDoUpdate({
        target: [clientSkillOverlays.clientContextId, clientSkillOverlays.skillId],
        set:    { ...body, updatedAt: new Date() },
      });

    res.json({ ok: true });
  });

  return router;
}
