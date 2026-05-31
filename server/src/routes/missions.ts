/**
 * server/src/routes/missions.ts
 *
 * WAR-4: Mission API.
 *
 * Missions are CEO-level strategic intent. The CEO creates missions via natural
 * language. The orchestrator decomposes them into tasks.
 *
 * GET    /companies/:companyId/missions              list active missions
 * POST   /companies/:companyId/missions              create mission
 * GET    /companies/:companyId/missions/:missionId   get mission + messages + tasks
 * POST   /companies/:companyId/missions/:missionId/messages  add message
 * PATCH  /companies/:companyId/missions/:missionId   update status
 * POST   /companies/:companyId/missions/:missionId/archive   archive
 */

import { Router } from "express";
import { z } from "zod";
import { and, eq, desc, ne, count, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { missions, missionMessages, missionTasks, issues } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "missions" });

const createMissionSchema = z.object({
  title: z.string().min(1).max(200),
  brief: z.string().min(1),
  orchestratorId: z.string().uuid().optional(),
});

const addMessageSchema = z.object({
  role:    z.enum(["user", "orchestrator", "system"]),
  content: z.string().min(1),
  agentId: z.string().uuid().optional(),
});

const patchMissionSchema = z.object({
  status: z.enum(["draft", "active", "blocked", "complete", "archived"]).optional(),
  title:  z.string().min(1).max(200).optional(),
  brief:  z.string().min(1).optional(),
});

export function missionRoutes(db: Db): Router {
  const router = Router();

  // GET /companies/:companyId/missions
  router.get("/companies/:companyId/missions", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select({
        id:          missions.id,
        title:       missions.title,
        brief:       missions.brief,
        status:      missions.status,
        createdAt:   missions.createdAt,
        completedAt: missions.completedAt,
      })
      .from(missions)
      .where(
        and(
          eq(missions.companyId, companyId),
          ne(missions.status, "archived"),
        ),
      )
      .orderBy(desc(missions.createdAt));

    res.json(rows);
  });

  // POST /companies/:companyId/missions
  router.post("/companies/:companyId/missions", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const body = createMissionSchema.parse(req.body);
    const [mission] = await db.insert(missions).values({
      companyId,
      title:          body.title,
      brief:          body.brief,
      orchestratorId: body.orchestratorId ?? null,
      status:         "active",
    }).returning();

    logger.info({ companyId, missionId: mission.id }, "missions: created");
    res.status(201).json(mission);
  });

  // GET /companies/:companyId/missions/:missionId
  router.get("/companies/:companyId/missions/:missionId", async (req, res) => {
    const { companyId, missionId } = req.params as { companyId: string; missionId: string };
    assertCompanyAccess(req, companyId);

    const [mission] = await db
      .select()
      .from(missions)
      .where(and(eq(missions.id, missionId), eq(missions.companyId, companyId)))
      .limit(1);

    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }

    const messages = await db
      .select()
      .from(missionMessages)
      .where(eq(missionMessages.missionId, missionId))
      .orderBy(missionMessages.createdAt);

    const taskLinks = await db
      .select({ taskId: missionTasks.taskId })
      .from(missionTasks)
      .where(eq(missionTasks.missionId, missionId));

    const taskIds = taskLinks.map((t) => t.taskId);
    const tasks = taskIds.length > 0
      ? await db
          .select({
            id:          issues.id,
            title:       issues.title,
            status:      issues.status,
            agentId:     issues.assigneeAgentId,
            createdAt:   issues.createdAt,
          })
          .from(issues)
          .where(eq(issues.missionId, missionId))
      : [];

    res.json({ ...mission, messages, tasks });
  });

  // POST /companies/:companyId/missions/:missionId/messages
  router.post("/companies/:companyId/missions/:missionId/messages", async (req, res) => {
    const { companyId, missionId } = req.params as { companyId: string; missionId: string };
    assertCompanyAccess(req, companyId);

    const [mission] = await db
      .select({ id: missions.id })
      .from(missions)
      .where(and(eq(missions.id, missionId), eq(missions.companyId, companyId)))
      .limit(1);

    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }

    const body = addMessageSchema.parse(req.body);
    const [msg] = await db.insert(missionMessages).values({
      missionId,
      role:    body.role,
      content: body.content,
      agentId: body.agentId ?? null,
    }).returning();

    res.status(201).json(msg);
  });

  // PATCH /companies/:companyId/missions/:missionId
  router.patch("/companies/:companyId/missions/:missionId", async (req, res) => {
    const { companyId, missionId } = req.params as { companyId: string; missionId: string };
    assertCompanyAccess(req, companyId);

    const body = patchMissionSchema.parse(req.body);
    const patch: Record<string, unknown> = { ...body };
    if (body.status === "complete") patch.completedAt = new Date();
    if (body.status === "archived") patch.archivedAt  = new Date();

    const [updated] = await db
      .update(missions)
      .set(patch)
      .where(and(eq(missions.id, missionId), eq(missions.companyId, companyId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Mission not found" }); return; }
    res.json(updated);
  });

  // ── WAR-10: dispatcher health (plain-language, never technical) ─────────────
  // GET /companies/:companyId/dispatcher-health
  router.get("/companies/:companyId/dispatcher-health", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    // Count active and pending tasks for this company
    const [row] = await db
      .select({ active: count() })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          inArray(issues.status, ["in_progress", "in_review"]),
        ),
      );

    const activeTasks = row?.active ?? 0;

    // Plain-language status per spec — never expose queue depth numbers to operators
    const status = activeTasks > 0 ? "working" : "idle";
    const message = activeTasks > 0
      ? `${activeTasks} tâche${activeTasks > 1 ? "s" : ""} en cours`
      : "Tout fonctionne normalement";

    res.json({ status, message, activeTasks });
  });

  // POST /companies/:companyId/missions/:missionId/archive
  router.post("/companies/:companyId/missions/:missionId/archive", async (req, res) => {
    const { companyId, missionId } = req.params as { companyId: string; missionId: string };
    assertCompanyAccess(req, companyId);

    const [updated] = await db
      .update(missions)
      .set({ status: "archived", archivedAt: new Date() })
      .where(and(eq(missions.id, missionId), eq(missions.companyId, companyId)))
      .returning({ id: missions.id });

    if (!updated) { res.status(404).json({ error: "Mission not found" }); return; }
    logger.info({ companyId, missionId }, "missions: archived");
    res.json({ ok: true });
  });

  return router;
}
