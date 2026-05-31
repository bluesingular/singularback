/**
 * server/src/routes/steer.ts
 *
 * AG-9: Real-time bidirectional steering.
 *
 * POST /companies/:companyId/tasks/:taskId/steer
 *
 * Only valid while task.status === 'in_progress'.
 * The operator injects a plain-language instruction into the running task.
 * The agent acknowledges at the next step boundary and applies it.
 *
 * Constraints (enforced, not configurable):
 *   - Cannot change target agent or skill
 *   - Cannot override approval gates
 *   - Can only influence content, tone, and approach
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, taskExecutionEvents } from "@paperclipai/db";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest, notFound, conflict } from "../errors.js";
import pino from "pino";

const logger = pino({ name: "steer" });

const steerBody = z.object({
  instruction: z.string().min(1).max(500),
});

export function steerRoutes(db: Db): Router {
  const router = Router();

  // POST /companies/:companyId/tasks/:taskId/steer
  router.post("/companies/:companyId/tasks/:taskId/steer", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params as { companyId: string; taskId: string };
      assertCompanyAccess(req, companyId);

      const parsed = steerBody.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

      const { instruction } = parsed.data;
      const actor = getActorInfo(req);

      // Steer only works on running tasks
      const [task] = await db
        .select({ status: issues.status })
        .from(issues)
        .where(and(eq(issues.id, taskId), eq(issues.companyId, companyId)))
        .limit(1);

      if (!task) throw notFound("Task not found");

      if (task.status !== "in_progress") {
        throw conflict(
          `Steer only applies to in_progress tasks (current: ${task.status})`,
        );
      }

      // Record the steer instruction as a task execution event
      // Worker polls these at each step boundary and injects as system message
      await db.insert(taskExecutionEvents).values({
        taskId,
        companyId,
        eventType: "operator_steer",
        content:   `[Instruction de l'opérateur]: ${instruction}`,
      });

      logger.info(
        { companyId, taskId, actorId: actor.actorId, instructionLength: instruction.length },
        "steer: instruction recorded",
      );

      res.json({ ok: true, taskId, queued: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
