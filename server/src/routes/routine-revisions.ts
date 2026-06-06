/**
 * server/src/routes/routine-revisions.ts
 *
 * Routine revision history — append-only log of all routine changes.
 *
 * GET  /companies/:companyId/routines/:routineId/revisions        list revisions
 * GET  /companies/:companyId/routines/:routineId/revisions/:rev   get one revision
 * POST /companies/:companyId/routines/:routineId/revisions/:rev/restore  restore
 *
 * Revisions are written automatically when a routine is updated (via the
 * PATCH /routines/:id endpoint). This file provides the read + restore surface.
 */

import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { routineRevisions, routines } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { notFound } from "../errors.js";
import pino from "pino";

const logger = pino({ name: "routine-revisions" });

export function routineRevisionRoutes(db: Db): Router {
  const router = Router();

  // GET /companies/:companyId/routines/:routineId/revisions
  router.get("/companies/:companyId/routines/:routineId/revisions", async (req, res, next) => {
    try {
      const { companyId, routineId } = req.params as { companyId: string; routineId: string };
      assertCompanyAccess(req, companyId);

      const rows = await db
        .select()
        .from(routineRevisions)
        .where(and(
          eq(routineRevisions.routineId, routineId),
          eq(routineRevisions.companyId, companyId),
        ))
        .orderBy(desc(routineRevisions.revisionNumber));

      res.json({ ok: true, revisions: rows });
    } catch (err) { next(err); }
  });

  // GET /companies/:companyId/routines/:routineId/revisions/:rev
  router.get("/companies/:companyId/routines/:routineId/revisions/:rev", async (req, res, next) => {
    try {
      const { companyId, routineId, rev } = req.params as { companyId: string; routineId: string; rev: string };
      assertCompanyAccess(req, companyId);

      const revNum = parseInt(rev, 10);
      if (isNaN(revNum)) { res.status(400).json({ ok: false, error: "Invalid revision number" }); return; }

      const [row] = await db
        .select()
        .from(routineRevisions)
        .where(and(
          eq(routineRevisions.routineId, routineId),
          eq(routineRevisions.companyId, companyId),
          eq(routineRevisions.revisionNumber, revNum),
        ))
        .limit(1);

      if (!row) throw notFound("Revision not found");
      res.json({ ok: true, revision: row });
    } catch (err) { next(err); }
  });

  // POST /companies/:companyId/routines/:routineId/revisions/:rev/restore
  router.post("/companies/:companyId/routines/:routineId/revisions/:rev/restore", async (req, res, next) => {
    try {
      const { companyId, routineId, rev } = req.params as { companyId: string; routineId: string; rev: string };
      assertCompanyAccess(req, companyId);

      const revNum = parseInt(rev, 10);
      const [revision] = await db
        .select()
        .from(routineRevisions)
        .where(and(
          eq(routineRevisions.routineId, routineId),
          eq(routineRevisions.companyId, companyId),
          eq(routineRevisions.revisionNumber, revNum),
        ))
        .limit(1);

      if (!revision) throw notFound("Revision not found");

      // Restore the routine from the snapshot
      const snap = revision.snapshot as Record<string, unknown>;
      const [updated] = await db
        .update(routines)
        .set({
          title:       revision.title,
          description: revision.description ?? null,
          variables:   revision.variables as any,
          updatedAt:   new Date(),
        })
        .where(and(eq(routines.id, routineId), eq(routines.companyId, companyId)))
        .returning({ id: routines.id, title: routines.title });

      if (!updated) throw notFound("Routine not found");

      // Write a new revision for the restore operation
      const [latestRev] = await db
        .select({ max: routineRevisions.revisionNumber })
        .from(routineRevisions)
        .where(eq(routineRevisions.routineId, routineId))
        .orderBy(desc(routineRevisions.revisionNumber))
        .limit(1);

      await db.insert(routineRevisions).values({
        routineId,
        companyId,
        revisionNumber:    (latestRev?.max ?? 0) + 1,
        title:             revision.title,
        description:       revision.description ?? null,
        variables:         revision.variables as any,
        changedByUserId:   (req as any).ctx?.userId ?? null,
        changeSummary:     `Restored from revision ${revNum}`,
        snapshot:          revision.snapshot as any,
      });

      logger.info({ companyId, routineId, restoredFrom: revNum }, "routine-revisions: restored");
      res.json({ ok: true, routine: updated });
    } catch (err) { next(err); }
  });

  return router;
}

// ── Helper: snapshot and record a revision whenever a routine changes ─────────

export async function recordRoutineRevision(
  db: Db,
  params: {
    routineId:       string;
    companyId:       string;
    title:           string;
    description?:    string | null;
    variables?:      unknown;
    changedByUserId?: string | null;
    changeSummary?:  string;
    snapshot:        Record<string, unknown>;
  },
): Promise<void> {
  const [latest] = await db
    .select({ max: routineRevisions.revisionNumber })
    .from(routineRevisions)
    .where(eq(routineRevisions.routineId, params.routineId))
    .orderBy(desc(routineRevisions.revisionNumber))
    .limit(1);

  await db.insert(routineRevisions).values({
    routineId:         params.routineId,
    companyId:         params.companyId,
    revisionNumber:    (latest?.max ?? 0) + 1,
    title:             params.title,
    description:       params.description ?? null,
    variables:         (params.variables as any) ?? [],
    changedByUserId:   params.changedByUserId ?? null,
    changeSummary:     params.changeSummary ?? null,
    snapshot:          params.snapshot as any,
  });
}
