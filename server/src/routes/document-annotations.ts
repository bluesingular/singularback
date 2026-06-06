/**
 * server/src/routes/document-annotations.ts
 *
 * Inline document annotations — revision-aware comment threads on passages.
 *
 * GET    /companies/:companyId/documents/:docId/annotations       list annotations
 * POST   /companies/:companyId/documents/:docId/annotations       create annotation
 * PATCH  /companies/:companyId/documents/:docId/annotations/:id   update body / resolve
 * DELETE /companies/:companyId/documents/:docId/annotations/:id   delete
 * POST   /companies/:companyId/documents/:docId/annotations/:id/replies  reply
 */

import { Router } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { documentAnnotations } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { notFound, badRequest } from "../errors.js";
import pino from "pino";

const logger = pino({ name: "document-annotations" });

const createBody = z.object({
  anchorStart:  z.number().int().min(0),
  anchorEnd:    z.number().int().min(0),
  selectedText: z.string().min(1).max(2000),
  body:         z.string().min(1).max(10000),
  revisionId:   z.string().uuid().optional(),
});

const replyBody = z.object({
  body: z.string().min(1).max(10000),
});

const updateBody = z.object({
  body:     z.string().min(1).max(10000).optional(),
  resolved: z.boolean().optional(),
});

export function documentAnnotationRoutes(db: Db): Router {
  const router = Router();

  // GET /companies/:companyId/documents/:docId/annotations
  router.get("/companies/:companyId/documents/:docId/annotations", async (req, res, next) => {
    try {
      const { companyId, docId } = req.params as { companyId: string; docId: string };
      assertCompanyAccess(req, companyId);

      // Top-level annotations only (no parentId) — replies fetched via nesting
      const rows = await db
        .select()
        .from(documentAnnotations)
        .where(and(
          eq(documentAnnotations.companyId, companyId),
          eq(documentAnnotations.documentId, docId),
          isNull(documentAnnotations.parentId),
        ))
        .orderBy(documentAnnotations.anchorStart);

      // Fetch replies for each top-level annotation
      const ids = rows.map((r) => r.id);
      const replies = ids.length === 0 ? [] : await db
        .select()
        .from(documentAnnotations)
        .where(and(
          eq(documentAnnotations.companyId, companyId),
          eq(documentAnnotations.documentId, docId),
        ))
        .orderBy(documentAnnotations.createdAt);

      const replyMap = new Map<string, typeof replies>();
      for (const r of replies) {
        if (!r.parentId) continue;
        if (!replyMap.has(r.parentId)) replyMap.set(r.parentId, []);
        replyMap.get(r.parentId)!.push(r);
      }

      const annotationsWithReplies = rows.map((a) => ({
        ...a,
        replies: replyMap.get(a.id) ?? [],
      }));

      res.json({ ok: true, annotations: annotationsWithReplies });
    } catch (err) { next(err); }
  });

  // POST /companies/:companyId/documents/:docId/annotations
  router.post("/companies/:companyId/documents/:docId/annotations", async (req, res, next) => {
    try {
      const { companyId, docId } = req.params as { companyId: string; docId: string };
      assertCompanyAccess(req, companyId);
      const body = createBody.parse(req.body);
      const userId = (req as any).ctx?.userId as string | undefined;

      if (body.anchorEnd < body.anchorStart) throw badRequest("anchorEnd must be ≥ anchorStart");

      const [row] = await db.insert(documentAnnotations).values({
        documentId:      docId,
        companyId,
        revisionId:      body.revisionId ?? null,
        anchorStart:     body.anchorStart,
        anchorEnd:       body.anchorEnd,
        selectedText:    body.selectedText,
        body:            body.body,
        createdByUserId: userId ?? null,
      }).returning();

      logger.info({ companyId, docId, annotationId: row.id }, "annotation: created");
      res.status(201).json({ ok: true, annotation: row });
    } catch (err) { next(err); }
  });

  // POST /companies/:companyId/documents/:docId/annotations/:id/replies
  router.post("/companies/:companyId/documents/:docId/annotations/:id/replies", async (req, res, next) => {
    try {
      const { companyId, docId, id: parentId } = req.params as { companyId: string; docId: string; id: string };
      assertCompanyAccess(req, companyId);
      const body = replyBody.parse(req.body);
      const userId = (req as any).ctx?.userId as string | undefined;

      // Verify parent exists
      const [parent] = await db.select({ id: documentAnnotations.id, anchorStart: documentAnnotations.anchorStart, anchorEnd: documentAnnotations.anchorEnd })
        .from(documentAnnotations)
        .where(and(eq(documentAnnotations.id, parentId), eq(documentAnnotations.companyId, companyId)))
        .limit(1);
      if (!parent) throw notFound("Annotation not found");

      const [row] = await db.insert(documentAnnotations).values({
        documentId:      docId,
        companyId,
        anchorStart:     parent.anchorStart,
        anchorEnd:       parent.anchorEnd,
        selectedText:    "",
        parentId,
        body:            body.body,
        createdByUserId: userId ?? null,
      }).returning();

      res.status(201).json({ ok: true, reply: row });
    } catch (err) { next(err); }
  });

  // PATCH /companies/:companyId/documents/:docId/annotations/:id
  router.patch("/companies/:companyId/documents/:docId/annotations/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const body = updateBody.parse(req.body);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.body     !== undefined) updates.body     = body.body;
      if (body.resolved !== undefined) updates.resolved = body.resolved;

      const [updated] = await db.update(documentAnnotations)
        .set(updates)
        .where(and(eq(documentAnnotations.id, id), eq(documentAnnotations.companyId, companyId)))
        .returning();

      if (!updated) throw notFound("Annotation not found");
      res.json({ ok: true, annotation: updated });
    } catch (err) { next(err); }
  });

  // DELETE /companies/:companyId/documents/:docId/annotations/:id
  router.delete("/companies/:companyId/documents/:docId/annotations/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);

      const [deleted] = await db.delete(documentAnnotations)
        .where(and(eq(documentAnnotations.id, id), eq(documentAnnotations.companyId, companyId)))
        .returning({ id: documentAnnotations.id });

      if (!deleted) throw notFound("Annotation not found");
      res.json({ ok: true, id: deleted.id });
    } catch (err) { next(err); }
  });

  return router;
}
