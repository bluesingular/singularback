/**
 * server/src/routes/away-mode.ts
 *
 * §11.6 — Away mode.
 *
 * POST /companies/:companyId/away-mode        set away period
 * DELETE /companies/:companyId/away-mode      cancel away mode
 * GET    /companies/:companyId/away-mode      current status
 * GET    /companies/:companyId/away-mode/briefing  catch-up briefing on return
 *
 * During away mode:
 *   - Pre-approved templates active for routine task types
 *   - Agents act within pre-approved parameters autonomously
 *   - Non-routine items queue for human review
 *
 * On return:
 *   - Catch-up briefing: "3 things need you. Everything else was handled."
 *   - Items ordered by urgency × opportunity cost of delay
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { awayMode, issues, missions } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "away-mode" });

const setAwaySchema = z.object({
  startsAt: z.string().datetime(),
  endsAt:   z.string().datetime(),
});

export function awayModeRoutes(db: Db): Router {
  const router = Router();

  // POST /companies/:companyId/away-mode
  router.post("/companies/:companyId/away-mode", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const { startsAt, endsAt } = setAwaySchema.parse(req.body);

    if (new Date(endsAt) <= new Date(startsAt)) {
      res.status(400).json({ error: "endsAt must be after startsAt" });
      return;
    }

    const [row] = await (db as any)
      .insert(awayMode)
      .values({ companyId, userId, startsAt: new Date(startsAt), endsAt: new Date(endsAt) })
      .onConflictDoUpdate({
        target: [(awayMode as any).companyId, (awayMode as any).userId, (awayMode as any).startsAt],
        set: { endsAt: new Date(endsAt) },
      })
      .returning({ id: awayMode.id });

    logger.info({ companyId, userId, startsAt, endsAt }, "away-mode: set");
    res.status(201).json({ ok: true, id: row.id });
  });

  // GET /companies/:companyId/away-mode
  router.get("/companies/:companyId/away-mode", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const now = new Date();
    const [active] = await (db as any)
      .select()
      .from(awayMode)
      .where(and(
        eq(awayMode.companyId, companyId),
        eq(awayMode.userId, userId),
        lte(awayMode.startsAt, now),
        gte(awayMode.endsAt, now),
      ))
      .limit(1);

    res.json({
      ok:    true,
      away:  !!active,
      period: active ? { startsAt: active.startsAt, endsAt: active.endsAt } : null,
    });
  });

  // DELETE /companies/:companyId/away-mode
  router.delete("/companies/:companyId/away-mode", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    const now = new Date();
    await (db as any)
      .delete(awayMode)
      .where(and(
        eq(awayMode.companyId, companyId),
        eq(awayMode.userId, userId),
        gte(awayMode.endsAt, now),
      ));

    logger.info({ companyId, userId }, "away-mode: cancelled");
    res.json({ ok: true });
  });

  // GET /companies/:companyId/away-mode/briefing
  // Returns catch-up briefing for returning operator
  router.get("/companies/:companyId/away-mode/briefing", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const userId = (req as any).ctx?.userId as string | undefined;
    if (!userId) { res.status(401).json({ error: "Unauthenticated" }); return; }

    // Find the most recent completed away period
    const now = new Date();
    const [lastAway] = await (db as any)
      .select()
      .from(awayMode)
      .where(and(
        eq(awayMode.companyId, companyId),
        eq(awayMode.userId, userId),
        lte(awayMode.endsAt, now),
      ))
      .orderBy(desc(awayMode.endsAt))
      .limit(1);

    if (!lastAway) {
      res.json({ ok: true, briefing: null });
      return;
    }

    // If briefing already generated, return it
    if (lastAway.briefingReady && lastAway.briefingMd) {
      res.json({ ok: true, briefing: lastAway.briefingMd });
      return;
    }

    // Generate briefing from tasks/missions during absence
    const briefing = await generateCatchUpBriefing(
      db, companyId, lastAway.startsAt, lastAway.endsAt,
    );

    // Store the generated briefing
    await (db as any)
      .update(awayMode)
      .set({ briefingMd: briefing, briefingReady: true })
      .where(eq(awayMode.id, lastAway.id));

    res.json({ ok: true, briefing });
  });

  return router;
}

// ── generateCatchUpBriefing ───────────────────────────────────────────────────

async function generateCatchUpBriefing(
  db:        Db,
  companyId: string,
  from:      Date,
  to:        Date,
): Promise<string> {
  const [taskStats] = await (db as any)
    .select({
      total:            `count(*)`,
      completed:        `count(*) filter (where status = 'completed')`,
      needsAttention:   `count(*) filter (where status in ('pending_approval','awaiting_clarification','partial_complete'))`,
      failed:           `count(*) filter (where status = 'failed')`,
    })
    .from(issues)
    .where(and(
      eq(issues.companyId, companyId),
      gte(issues.createdAt, from),
      lte(issues.createdAt, to),
    ));

  const total     = Number(taskStats?.total           ?? 0);
  const completed = Number(taskStats?.completed        ?? 0);
  const attention = Number(taskStats?.needsAttention   ?? 0);
  const failed    = Number(taskStats?.failed           ?? 0);
  const handled   = total - attention - failed;

  const lines = [
    `## Récapitulatif de votre absence`,
    ``,
    attention > 0
      ? `**${attention} élément${attention > 1 ? "s" : ""} require${attention === 1 ? "" : "nt"} votre attention.**`
      : `**Aucune action requise de votre part.**`,
    ``,
    `${handled > 0 ? `✓ ${handled} tâche${handled > 1 ? "s" : ""} traitée${handled > 1 ? "s" : ""} automatiquement.` : ""}`,
    `${completed > 0 ? `✓ ${completed} tâche${completed > 1 ? "s" : ""} terminée${completed > 1 ? "s" : ""}.` : ""}`,
    `${failed > 0 ? `✗ ${failed} tâche${failed > 1 ? "s" : ""} en échec.` : ""}`,
    ``,
    `Voir le tableau de bord →`,
  ].filter(Boolean);

  return lines.join("\n");
}
