/**
 * server/src/routes/document-studio.ts
 *
 * §17 — Proposal and Document Studio routes.
 *
 * POST /companies/:companyId/documents/generate
 *   Generate a branded document — creates a task pending approval.
 *
 * GET  /companies/:companyId/documents/types
 *   List supported document types and their metadata.
 */

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { generateDocument } from "../documents/studio.js";
import pino from "pino";

const logger = pino({ name: "document-studio-routes" });

const DOCUMENT_TYPES = [
  "commercial_proposal",
  "client_progress_report",
  "meeting_summary",
  "market_research_brief",
  "administrative_template",
  "custom",
] as const;

const generateSchema = z.object({
  documentType:    z.enum(DOCUMENT_TYPES),
  title:           z.string().min(1).max(200),
  brief:           z.string().min(10).max(4000),
  contactId:       z.string().uuid().optional(),
  customStructure: z.array(z.string()).optional(),
  assigneeAgentId: z.string().uuid().optional(),
});

const TYPE_META: Record<typeof DOCUMENT_TYPES[number], { label: string; maxPages: number }> = {
  commercial_proposal:    { label: "Proposition commerciale",  maxPages: 6 },
  client_progress_report: { label: "Rapport d'avancement",    maxPages: 4 },
  meeting_summary:        { label: "Compte-rendu de réunion", maxPages: 2 },
  market_research_brief:  { label: "Brief de recherche",      maxPages: 3 },
  administrative_template:{ label: "Document administratif",  maxPages: 2 },
  custom:                 { label: "Document personnalisé",   maxPages: 10 },
};

export function documentStudioRoutes(db: Db): Router {
  const router = Router();

  // GET /companies/:companyId/documents/types
  router.get("/companies/:companyId/documents/types", (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const types = DOCUMENT_TYPES.map((slug) => ({
      slug,
      ...TYPE_META[slug],
    }));
    res.json({ ok: true, data: types });
  });

  // POST /companies/:companyId/documents/generate
  router.post("/companies/:companyId/documents/generate", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const body = generateSchema.parse(req.body);
      const actor = getActorInfo(req);

      const result = await generateDocument(db, {
        companyId,
        requestedBy:    actor.actorId ?? "unknown",
        documentType:   body.documentType,
        title:          body.title,
        brief:          body.brief,
        contactTitle:   undefined,
        customStructure: body.customStructure,
        assigneeAgentId: body.assigneeAgentId,
      });

      logger.info({ companyId, taskId: result.taskId, documentType: body.documentType }, "document-studio: generated");

      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
