/**
 * server/src/routes/ceo-health.ts
 *
 * §11.7 — CEO Health Score route.
 *
 * GET /companies/:companyId/ceo-health
 *   Returns current CEO ratio + sparkline + shareable card.
 *
 * GET /companies/:companyId/ceo-health/history
 *   Returns last 6 months of scores.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { computeCeoHealthScore } from "../intelligence/ceo-health.js";

export function ceoHealthRoutes(db: Db): Router {
  const router = Router();

  router.get("/companies/:companyId/ceo-health", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const score = await computeCeoHealthScore(db, companyId, 0);
      res.json({ ok: true, data: score });
    } catch (err) { next(err); }
  });

  router.get("/companies/:companyId/ceo-health/history", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const months = await Promise.all(
        [0, 1, 2, 3, 4, 5].map((n) => computeCeoHealthScore(db, companyId, n))
      );
      res.json({ ok: true, data: months });
    } catch (err) { next(err); }
  });

  return router;
}
