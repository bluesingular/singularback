/**
 * G9 — Batch processing routes.
 *
 * POST   /companies/:companyId/batches                    → fan-out N items (operator+)
 * GET    /companies/:companyId/batches/:batchId           → status + item counts
 * POST   /companies/:companyId/batches/:batchId/approve   → approve batch outcome (operator+)
 * POST   /companies/:companyId/batches/:batchId/reject    → reject batch outcome (operator+)
 */

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { badRequest, notFound } from "../errors.js";
import {
  createBatch,
  getBatchStatus,
  approveBatch,
  rejectBatch,
} from "../batch/runner.js";

const createBatchBody = z.object({
  skillType:      z.string().min(1, "skillType is required"),
  agentId:        z.string().uuid("agentId must be a UUID").optional(),
  parentIssueId:  z.string().uuid("parentIssueId must be a UUID").optional(),
  items:          z.array(z.record(z.unknown())).min(1, "items must contain at least one entry"),
});

export function batchRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });

  // ── POST /companies/:companyId/batches ────────────────────────────────────
  router.post("/companies/:companyId/batches", async (req, res, next) => {
    try {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const body = createBatchBody.safeParse(req.body);
      if (!body.success) throw badRequest(body.error.issues[0]?.message ?? "Invalid body");

      const { skillType, agentId, parentIssueId, items } = body.data;
      const batchRunId = await createBatch(db, {
        companyId,
        skillType,
        agentId:         agentId ?? null,
        parentIssueId:   parentIssueId ?? null,
        createdByUserId: req.ctx?.userId ?? null,
        items,
      });

      res.status(201).json({ ok: true, batchRunId, itemCount: items.length });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /companies/:companyId/batches/:batchId ────────────────────────────
  router.get("/companies/:companyId/batches/:batchId", async (req, res, next) => {
    try {
      const { companyId, batchId } = req.params;
      assertCompanyAccess(req, companyId);

      const batch = await getBatchStatus(db, batchId, companyId);
      if (!batch) throw notFound("Batch not found");

      res.json(batch);
    } catch (err) {
      next(err);
    }
  });

  // ── POST /companies/:companyId/batches/:batchId/approve ───────────────────
  router.post("/companies/:companyId/batches/:batchId/approve", async (req, res, next) => {
    try {
      const { companyId, batchId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const actorId = req.ctx?.userId;
      if (!actorId) throw badRequest("userId missing from context");

      await approveBatch(db, batchId, companyId, actorId);
      res.json({ ok: true, batchRunId: batchId, status: "approved" });
    } catch (err) {
      next(err);
    }
  });

  // ── POST /companies/:companyId/batches/:batchId/reject ────────────────────
  router.post("/companies/:companyId/batches/:batchId/reject", async (req, res, next) => {
    try {
      const { companyId, batchId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const actorId = req.ctx?.userId;
      if (!actorId) throw badRequest("userId missing from context");

      await rejectBatch(db, batchId, companyId, actorId);
      res.json({ ok: true, batchRunId: batchId, status: "rejected" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
