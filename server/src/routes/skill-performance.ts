/**
 * server/src/routes/skill-performance.ts
 *
 * §20.8 — Tenant skill performance dashboard.
 *
 * GET /companies/:companyId/skills-performance
 *   Returns per-skill performance stats for the past 30 days so operators
 *   can see how their skill copies are performing without any technical detail.
 *
 * Data sources:
 *   - company_skills: version lineage + master update indicator
 *   - issues (tasks): task count per skill_type
 *   - judge_results: avg quality score per skill_type
 *   - golden_datasets: example count per skill_type
 *
 * Operator-facing: never exposes raw SQL or technical identifiers.
 */

import { Router } from "express";
import { and, eq, gte, avg, count, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companySkills, issues, judgeResults, goldenDatasets } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import pino from "pino";

const logger = pino({ name: "skill-performance" });

export function skillPerformanceRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/skills-performance
  router.get("/companies/:companyId/skills-performance", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const since = new Date();
      since.setDate(since.getDate() - 30);

      // ── 1. Fetch all tenant skill copies for this company ──────────────────
      const skills = await db
        .select({
          id:            companySkills.id,
          slug:          companySkills.slug,
          name:          companySkills.name,
          masterVersion: companySkills.masterVersion,
          sourceSkillId: companySkills.sourceSkillId,
          gdprRequired:  companySkills.gdprRequired,
          tier:          companySkills.tier,
        })
        .from(companySkills)
        .where(eq(companySkills.companyId, companyId))
        .orderBy(companySkills.name);

      if (skills.length === 0) {
        return res.json({ skills: [] });
      }

      const skillSlugs = skills.map((s) => s.slug);

      // ── 2. Task counts (30 days) per skill type ────────────────────────────
      type TaskStat = { skillType: string | null; taskCount: number; doneTasks: number };
      const taskStats: TaskStat[] = await db
        .select({
          skillType:  issues.skillType,
          taskCount:  count(issues.id),
          doneTasks:  sql<number>`COUNT(*) FILTER (WHERE ${issues.status} IN ('done','completed'))`.as("done_tasks"),
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            gte(issues.createdAt, since),
            inArray(issues.skillType, skillSlugs),
          ),
        )
        .groupBy(issues.skillType)
        .catch((): TaskStat[] => []);

      // ── 3. Avg judge score (30 days) per skill type ────────────────────────
      // judgeResults links to tasks via task_id → join with issues for skill_type
      type JudgeStat = { skillType: string | null; avgScore: string | null };
      const judgeStats: JudgeStat[] = await db
        .select({
          skillType: issues.skillType,
          avgScore:  avg(judgeResults.overallScore),
        })
        .from(judgeResults)
        .innerJoin(issues, eq(issues.id, judgeResults.taskId))
        .where(
          and(
            eq(judgeResults.companyId, companyId),
            gte(judgeResults.createdAt, since),
          ),
        )
        .groupBy(issues.skillType)
        .catch((): JudgeStat[] => []);

      // ── 4. Golden dataset counts per skill type ────────────────────────────
      type GoldenStat = { skillType: string; goldenCount: number };
      const goldenStats: GoldenStat[] = await db
        .select({
          skillType:    goldenDatasets.skillType,
          goldenCount:  count(goldenDatasets.id),
        })
        .from(goldenDatasets)
        .where(eq(goldenDatasets.companyId, companyId))
        .groupBy(goldenDatasets.skillType)
        .catch((): GoldenStat[] => []);

      // ── 5. Master version lookup for update indicator ──────────────────────
      // For each skill that has a sourceSkillId, check if the master has a newer version
      const masterIds = skills.filter((s) => s.sourceSkillId).map((s) => s.sourceSkillId!);
      const masterVersions: Record<string, string | null> = {};
      if (masterIds.length > 0) {
        const masters = await db
          .select({ id: companySkills.id, masterVersion: companySkills.masterVersion })
          .from(companySkills)
          .where(inArray(companySkills.id, masterIds));
        for (const m of masters) {
          masterVersions[m.id] = m.masterVersion;
        }
      }

      // ── 6. Merge into response ─────────────────────────────────────────────
      const taskMap = Object.fromEntries(
        taskStats.map((r) => [r.skillType, { total: Number(r.taskCount), done: Number(r.doneTasks) }]),
      );
      const judgeMap = Object.fromEntries(
        judgeStats.map((r) => [r.skillType, Number(r.avgScore ?? 0)]),
      );
      const goldenMap = Object.fromEntries(
        goldenStats.map((r) => [r.skillType, Number(r.goldenCount)]),
      );

      const result = skills.map((skill) => {
        const stats = taskMap[skill.slug] ?? { total: 0, done: 0 };
        const avgScore = judgeMap[skill.slug] ?? null;
        const goldenCount = goldenMap[skill.slug] ?? 0;

        // Has update if master version differs from tenant copy's recorded master version
        const masterCurrentVersion = skill.sourceSkillId ? masterVersions[skill.sourceSkillId] : null;
        const hasUpdate = masterCurrentVersion != null
          && skill.masterVersion != null
          && masterCurrentVersion !== skill.masterVersion;

        return {
          slug:            skill.slug,
          name:            skill.name,
          gdprRequired:    skill.gdprRequired,
          tier:            skill.tier,
          taskCount:       stats.total,
          completedCount:  stats.done,
          avgJudgeScore:   avgScore != null ? Math.round(avgScore * 10) / 10 : null,
          goldenCount,
          hasUpdate,
          installedVersion: skill.masterVersion,
          masterVersion:   masterCurrentVersion,
        };
      });

      res.json({ skills: result, since: since.toISOString() });
    } catch (err) {
      logger.error({ err }, "skill-performance: route error");
      next(err);
    }
  });

  return router;
}
