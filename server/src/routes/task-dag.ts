/**
 * G8 — Task DAG routes.
 *
 * Manages blocking dependencies between tasks (issues).
 * A "blocks" relation means Task A must be approved before Task B can start.
 * Task B is automatically set to "blocked" status when a dependency is added.
 *
 * POST   /companies/:companyId/tasks/:taskId/blocks               → add dependency
 * DELETE /companies/:companyId/tasks/:taskId/blocks/:downstreamId → remove dependency
 * GET    /companies/:companyId/tasks/:taskId/dag                  → view upstream + downstream
 */

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { badRequest } from "../errors.js";
import { addDependency, removeDependency, getDagView } from "../tasks/dag.js";

const addBlockBody = z.object({
  downstreamTaskId: z.string().uuid("downstreamTaskId must be a UUID"),
});

export function taskDagRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });

  // ── POST /companies/:companyId/tasks/:taskId/blocks ───────────────────────
  router.post("/companies/:companyId/tasks/:taskId/blocks", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const body = addBlockBody.safeParse(req.body);
      if (!body.success) throw badRequest(body.error.issues[0]?.message ?? "Invalid body");

      const { downstreamTaskId } = body.data;
      if (downstreamTaskId === taskId) throw badRequest("A task cannot block itself");

      await addDependency(db, taskId, downstreamTaskId, companyId, req.ctx?.userId);
      res.status(201).json({ ok: true, blockerId: taskId, dependentId: downstreamTaskId });
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE /companies/:companyId/tasks/:taskId/blocks/:downstreamId ───────
  router.delete("/companies/:companyId/tasks/:taskId/blocks/:downstreamId", async (req, res, next) => {
    try {
      const { companyId, taskId, downstreamId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      await removeDependency(db, taskId, downstreamId, companyId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /companies/:companyId/tasks/:taskId/dag ───────────────────────────
  router.get("/companies/:companyId/tasks/:taskId/dag", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params;
      assertCompanyAccess(req, companyId);

      const dag = await getDagView(db, taskId, companyId);
      res.json({ taskId, ...dag });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
