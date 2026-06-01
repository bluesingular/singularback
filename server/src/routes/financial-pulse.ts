/**
 * server/src/routes/financial-pulse.ts
 *
 * §18 — Financial Pulse route.
 *
 * GET /companies/:companyId/financial-pulse
 *   Returns the full financial snapshot for the Financial Pulse screen.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { getFinancialPulse } from "../intelligence/financial-pulse.js";

export function financialPulseRoutes(db: Db): Router {
  const router = Router();

  router.get("/companies/:companyId/financial-pulse", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const pulse = await getFinancialPulse(db, companyId);
      res.json({ ok: true, data: pulse });
    } catch (err) { next(err); }
  });

  return router;
}
