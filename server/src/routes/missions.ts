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
import { and, eq, desc, ne, count, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { missions, missionMessages, missionTasks, issues, costRecords, agents, judgeResults } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import { approvePartialOutput, requestPartialCompletion } from "../tasks/partial-output.js";
import { recordOutcome } from "../learning/outcome-attribution.js";
import {
  setMissionSkillOverrides,
  getMissionSkillOverrides,
  getEffectiveSkillsForAgent,
  SkillNotInstalledError,
} from "../missions/skill-composition.js";
import pino from "pino";

const logger = pino({ name: "missions" });

const skillOverrideSchema = z.object({
  agent_id:          z.string().uuid(),
  additional_skills: z.array(z.string()).default([]),
  removed_skills:    z.array(z.string()).default([]),
});

const createMissionSchema = z.object({
  title:          z.string().min(1).max(200),
  brief:          z.string().min(1),
  orchestratorId: z.string().uuid().optional(),
  skillOverrides: z.array(skillOverrideSchema).optional(),
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

    if (body.skillOverrides && body.skillOverrides.length > 0) {
      await setMissionSkillOverrides(db, {
        missionId: mission.id,
        companyId,
        overrides: body.skillOverrides,
      });
    }

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

  // ── AG-15: skill overrides ────────────────────────────────────────────────────

  // GET /companies/:companyId/missions/:missionId/skill-overrides
  router.get("/companies/:companyId/missions/:missionId/skill-overrides", async (req, res, next) => {
    try {
      const { companyId, missionId } = req.params as { companyId: string; missionId: string };
      assertCompanyAccess(req, companyId);
      const overrides = await getMissionSkillOverrides(db, missionId, companyId);
      res.json({ ok: true, data: overrides ?? [] });
    } catch (err) { next(err); }
  });

  // PUT /companies/:companyId/missions/:missionId/skill-overrides
  router.put("/companies/:companyId/missions/:missionId/skill-overrides", async (req, res, next) => {
    try {
      const { companyId, missionId } = req.params as { companyId: string; missionId: string };
      assertCompanyAccess(req, companyId);
      const overrides = z.array(skillOverrideSchema).parse(req.body.overrides ?? req.body);
      await setMissionSkillOverrides(db, { missionId, companyId, overrides });
      res.json({ ok: true, data: null });
    } catch (err) {
      if (err instanceof SkillNotInstalledError) {
        res.status(422).json({ ok: false, error: { code: "SWWARM_SKILL_NOT_INSTALLED", message: err.message } });
        return;
      }
      next(err);
    }
  });

  // GET /companies/:companyId/missions/:missionId/agents/:agentId/effective-skills
  router.get(
    "/companies/:companyId/missions/:missionId/agents/:agentId/effective-skills",
    async (req, res, next) => {
      try {
        const { companyId, missionId, agentId } = req.params as {
          companyId: string; missionId: string; agentId: string;
        };
        assertCompanyAccess(req, companyId);
        const skills = await getEffectiveSkillsForAgent(db, { missionId, companyId, agentId });
        res.json({ ok: true, data: skills });
      } catch (err) { next(err); }
    },
  );

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
      ? `${activeTasks} task${activeTasks > 1 ? "s" : ""} running`
      : "All agents active";

    res.json({ status, message, activeTasks });
  });

  // ── Gap H: Partial output decision endpoints ──────────────────────────────

  // POST /companies/:companyId/tasks/:taskId/partial/approve
  router.post("/companies/:companyId/tasks/:taskId/partial/approve", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params as { companyId: string; taskId: string };
      assertCompanyAccess(req, companyId);
      await approvePartialOutput(db, taskId, companyId);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // POST /companies/:companyId/tasks/:taskId/partial/request-completion
  router.post("/companies/:companyId/tasks/:taskId/partial/request-completion", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params as { companyId: string; taskId: string };
      assertCompanyAccess(req, companyId);
      await requestPartialCompletion(db, taskId, companyId);
      res.json({ ok: true });
    } catch (err) { next(err); }
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

  // GET /companies/:companyId/missions/:missionId/cost
  // Gap I: cost attribution — returns total cost for a mission in EUR
  router.get("/companies/:companyId/missions/:missionId/cost", async (req, res) => {
    const { companyId, missionId } = req.params as { companyId: string; missionId: string };
    assertCompanyAccess(req, companyId);

    const [row] = await db
      .select({ totalMicro: sql<number>`coalesce(sum(cost_eur_micro), 0)` })
      .from(costRecords)
      .where(and(
        eq(costRecords.companyId, companyId),
        eq((costRecords as any).missionId, missionId),
      ));

    const totalEur = (Number(row?.totalMicro ?? 0) / 1_000_000).toFixed(2);
    res.json({ missionId, totalEur: parseFloat(totalEur) });
  });

  // POST /companies/:companyId/missions/:missionId/outcome
  // AG-7: record mission outcome → triggers attribution pipeline
  router.post("/companies/:companyId/missions/:missionId/outcome", async (req, res) => {
    const { companyId, missionId } = req.params as { companyId: string; missionId: string };
    assertCompanyAccess(req, companyId);

    const { outcome } = z.object({
      outcome: z.enum(["positive", "negative", "neutral"]),
    }).parse(req.body);

    const result = await recordOutcome({ db, companyId, missionId, outcome });
    logger.info({ companyId, missionId, outcome, ...result }, "missions: outcome recorded");
    res.json({ ok: true, ...result });
  });

  // ── WAR-6: Operatives floor — agents with current task status ─────────────
  // GET /companies/:companyId/agents-floor
  // Returns all non-deactivated agents with their current running task (if any).
  // Polled every 10s by the CEO Console for live floor display.
  router.get("/companies/:companyId/agents-floor", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      // Fetch agents
      const agentRows = await db
        .select({
          id:          agents.id,
          slug:        agents.slug,
          displayName: agents.displayName,
          colour:      agents.colour,
          status:      agents.status,
        })
        .from(agents)
        .where(
          and(
            eq(agents.companyId, companyId),
            ne(agents.status, "deactivated"),
          ),
        )
        .orderBy(agents.displayName);

      if (agentRows.length === 0) {
        return res.json({ agents: [] });
      }

      // Fetch current running task per agent
      const runningTasks = await db
        .select({
          assigneeId: issues.assigneeAgentId,
          taskId:     issues.id,
          title:      issues.title,
          status:     issues.status,
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            inArray(issues.status, ["in_progress", "in_review", "awaiting_clarification"]),
            inArray(issues.assigneeAgentId, agentRows.map((a) => a.id)),
          ),
        )
        .orderBy(desc(issues.updatedAt))
        .limit(agentRows.length * 2); // at most 2 tasks per agent

      // Build lookup: agentId → most recent active task
      const taskByAgent = new Map<string, typeof runningTasks[number]>();
      for (const task of runningTasks) {
        if (task.assigneeId && !taskByAgent.has(task.assigneeId)) {
          taskByAgent.set(task.assigneeId, task);
        }
      }

      const floor = agentRows.map((agent) => {
        const task = taskByAgent.get(agent.id) ?? null;
        return {
          id:          agent.id,
          slug:        agent.slug,
          displayName: agent.displayName,
          colour:      agent.colour,
          status:      agent.status,
          currentTask: task ? {
            id:       task.taskId,
            title:    task.title ?? "Tâche en cours",
            status:   task.status,
            fragment: null,
          } : null,
        };
      });

      res.json({ agents: floor });
    } catch (err) {
      next(err);
    }
  });

  // ── C8: Task approval context — judge score breakdown ────────────────────
  // GET /companies/:companyId/tasks/:taskId/approval-context
  //
  // Returns judge evaluation for the task's latest output.
  // Gap B inline editing uses PATCH .../inline-edit (task ID, not approval ID).
  //
  // Spec display format (PLATFORM_FUNCTIONAL_SPEC_v8 §C8):
  //   "Évaluation automatique: 8.2/10
  //    ├── Pertinence: 9/10 — Répond précisément à la demande
  //    ├── Exactitude: 8/10 — Affirmations vérifiables
  //    ..."
  router.get("/companies/:companyId/tasks/:taskId/approval-context", async (req, res, next) => {
    try {
      const { companyId, taskId } = req.params as { companyId: string; taskId: string };
      assertCompanyAccess(req, companyId);

      // Latest judge result for this task
      const judgeRow = await db
        .select({
          overallScore:  judgeResults.overallScore,
          dimensions:    judgeResults.dimensions,
          autoRecycled:  judgeResults.autoRecycled,
          outputVersion: judgeResults.outputVersion,
        })
        .from(judgeResults)
        .where(
          and(
            eq(judgeResults.taskId, taskId),
            eq(judgeResults.companyId, companyId),
          ),
        )
        .orderBy(desc(judgeResults.outputVersion))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!judgeRow) {
        return res.json({ hasJudge: false });
      }

      const score = Number(judgeRow.overallScore);

      // French label map for dimension keys
      const DIM_LABELS: Record<string, string> = {
        relevance:       "Relevance",
        accuracy:        "Accuracy",
        tone:            "Tone",
        completeness:    "Completeness",
        scopeAdherence:  "Scope",
        scope_adherence: "Scope",
      };

      const dims = judgeRow.dimensions as Record<
        string,
        { score: number; note: string }
      > | null;

      // Full breakdown: [{label, score, note}] — shown in approval card per spec
      const dimensionBreakdown = dims
        ? Object.entries(dims).map(([key, v]) => ({
            key,
            label: DIM_LABELS[key] ?? key,
            score: Math.round(Number(v.score)),
            note:  v.note ?? "",
          }))
        : [];

      res.json({
        hasJudge:           true,
        overallScore:       score,          // "8.2/10" format — shown per spec
        autoRecycled:       judgeRow.autoRecycled,
        outputVersion:      judgeRow.outputVersion,
        dimensionBreakdown,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
