/**
 * G7 — Skill version pin routes.
 *
 * GET    /companies/:companyId/tasks/:taskId/skill-version
 *   → Returns the pinned skill version for a task (or the active version if not pinned)
 *
 * POST   /companies/:companyId/tasks/:taskId/skill-version/pin
 *   → Pins the current active version to a task (operator+)
 *
 * POST   /companies/:companyId/skill-versions/:versionId/activate
 *   → Activates a skill version; deprecates the previous active one (operator+)
 *     New tasks will pick up this version; pinned tasks are unaffected.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { notFound, badRequest } from "../errors.js";
import {
  resolveSkillForTask,
  pinSkillVersion,
  activateSkillVersion,
} from "../tasks/skill-version.js";

const pinBody = z.object({
  skillType: z.string().min(1, "skillType is required"),
});

export function skillVersionRoutes(db: Db): Router {
  const router = Router({ mergeParams: true });

  // ── GET task's effective skill version ────────────────────────────────────
  router.get("/companies/:companyId/tasks/:taskId/skill-version", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params;
      assertCompanyAccess(req, companyId);

      const skill = await resolveSkillForTask(db, taskId, companyId);
      if (!skill) throw notFound("No skill version found for this task");

      res.json({
        taskId,
        versionId:   skill.versionId,
        version:     skill.version,
        skillType:   skill.skillType,
        pinned:      skill.pinned,
        frontmatter: skill.frontmatter,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Pin current active version to a task ──────────────────────────────────
  router.post("/companies/:companyId/tasks/:taskId/skill-version/pin", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      const parsed = pinBody.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

      const versionId = await pinSkillVersion(db, taskId, companyId, parsed.data.skillType);
      if (!versionId) throw notFound("No active skill version found for this skill type");

      res.status(201).json({ ok: true, taskId, versionId });
    } catch (err) {
      next(err);
    }
  });

  // ── Activate a skill version ───────────────────────────────────────────────
  router.post("/companies/:companyId/skill-versions/:versionId/activate", async (req, res, next) => {
    try {
      const { companyId, versionId } = req.params;
      assertCompanyAccess(req, companyId);
      requireRole(req, "operator");

      await activateSkillVersion(db, versionId, companyId);
      res.json({ ok: true, versionId });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
