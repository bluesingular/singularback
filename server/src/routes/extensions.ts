/**
 * G15 — Third-party action type registration routes.
 *
 * POST   /companies/:companyId/action-types            — register action type (operator+)
 * GET    /companies/:companyId/action-types            — list active action types (operator+)
 * GET    /companies/:companyId/action-types/:id        — get single action type (operator+)
 * DELETE /companies/:companyId/action-types/:id        — deactivate action type (operator+)
 * POST   /companies/:companyId/action-types/:id/invoke — invoke action type (operator+)
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { badRequest, notFound } from "../errors.js";
import {
  registerActionType,
  listActionTypes,
  getActionType,
  deactivateActionType,
  invokeActionType,
} from "../extensions/action-type-registry.js";

export function extensionRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });

  // POST /companies/:companyId/action-types
  router.post("/companies/:companyId/action-types", async (req, res, next) => {
    try {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const { slug, name, description, inputSchema, outputSchema, webhookUrl } = req.body ?? {};
      if (!slug || typeof slug !== "string")        throw badRequest("slug is required");
      if (!name || typeof name !== "string")        throw badRequest("name is required");
      if (!webhookUrl || typeof webhookUrl !== "string") throw badRequest("webhookUrl is required");

      try { new URL(webhookUrl); } catch { throw badRequest("webhookUrl must be a valid URL"); }

      // slug: only lowercase letters, digits, hyphens
      if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
        throw badRequest("slug must be lowercase letters, digits or hyphens, max 64 chars");
      }

      const row = await registerActionType(db, {
        companyId,
        slug,
        name,
        description,
        inputSchema,
        outputSchema,
        webhookUrl,
        createdByUserId: (req as any).actor?.userId ?? undefined,
      });

      res.status(201).json({ ok: true, actionType: row });
    } catch (err) {
      next(err);
    }
  });

  // GET /companies/:companyId/action-types
  router.get("/companies/:companyId/action-types", async (req, res, next) => {
    try {
      const { companyId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const actionTypes = await listActionTypes(db, companyId);
      res.json({ actionTypes });
    } catch (err) {
      next(err);
    }
  });

  // GET /companies/:companyId/action-types/:id
  router.get("/companies/:companyId/action-types/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const row = await getActionType(db, id, companyId);
      if (!row) throw notFound("Action type not found");
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  // DELETE /companies/:companyId/action-types/:id
  router.delete("/companies/:companyId/action-types/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const row = await deactivateActionType(db, id, companyId);
      if (!row) throw notFound("Action type not found or already inactive");
      res.json({ ok: true, id: row.id });
    } catch (err) {
      next(err);
    }
  });

  // POST /companies/:companyId/action-types/:id/invoke
  router.post("/companies/:companyId/action-types/:id/invoke", async (req, res, next) => {
    try {
      const { companyId, id } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const input = req.body?.input ?? req.body ?? {};
      const result = await invokeActionType(db, id, companyId, input);

      res.status(result.ok ? 200 : 502).json({
        ok: result.ok,
        status: result.status,
        data: result.data,
      });
    } catch (err: any) {
      if (err?.message === "Action type not found") {
        next(notFound("Action type not found"));
      } else if (err?.message === "Action type is not active") {
        next(badRequest("Action type is not active"));
      } else {
        next(err);
      }
    }
  });

  return router;
}
