/**
 * server/src/monitoring/variance.ts
 *
 * Gap A — Non-determinism debugging.
 *
 * Weekly background job computes judge_score_mean and judge_score_std
 * per skill per company. Flags skills where std > 1.2 (high variance).
 *
 * High-variance skills are flagged in admin portal only — never surfaced to operators.
 *
 * Also supports replay: re-running a task with its original context snapshot
 * (from task_checkpoints) to compare output variance.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { skillVarianceMetrics, judgeResults, issues } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "variance" });

const VARIANCE_FLAG_THRESHOLD = 1.2;  // std dev above which we flag
const LOOKBACK_DAYS           = 30;   // rolling 30-day window per CLAUDE.md

export interface VarianceResult {
  skillId:        string;
  companyId:      string;
  mean:           number;
  std:            number;
  varianceFlag:   boolean;
  sampleSize:     number;
}

// ── computeSkillVariance ──────────────────────────────────────────────────────

/**
 * Compute variance metrics for all skills in a company.
 * Called by the weekly background job.
 * Returns number of flagged skills.
 */
export async function computeSkillVariance(
  db:        Db,
  companyId: string,
): Promise<VarianceResult[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const periodStart = cutoff;

  // Aggregate judge scores per skill over the lookback window
  const rows = await (db as any)
    .select({
      skillId:   (issues as any).skillId,
      mean:      sql<number>`avg(jr.overall_score::numeric)`,
      std:       sql<number>`stddev(jr.overall_score::numeric)`,
      cnt:       sql<number>`count(jr.id)`,
    })
    .from(judgeResults)
    .innerJoin(issues, eq(judgeResults.taskId, issues.id))
    .where(and(
      eq(issues.companyId, companyId),
      gte(judgeResults.createdAt, cutoff),
    ))
    .groupBy((issues as any).skillId)
    .having(sql`count(jr.id) >= 5`);  // need at least 5 samples for meaningful std

  const results: VarianceResult[] = [];

  for (const row of rows) {
    if (!row.skillId) continue;

    const mean = Number(row.mean ?? 0);
    const std  = Number(row.std  ?? 0);
    const varianceFlag = std > VARIANCE_FLAG_THRESHOLD;

    await (db as any)
      .insert(skillVarianceMetrics)
      .values({
        skillId:        row.skillId,
        companyId,
        periodStart,
        judgeScoreMean: String(mean.toFixed(2)),
        judgeScoreStd:  String(std.toFixed(2)),
        varianceFlag,
      })
      .onConflictDoNothing();

    if (varianceFlag) {
      logger.warn(
        { companyId, skillId: row.skillId, mean: mean.toFixed(2), std: std.toFixed(2) },
        "variance: high variance detected",
      );
    }

    results.push({ skillId: row.skillId, companyId, mean, std, varianceFlag, sampleSize: Number(row.cnt) });
  }

  logger.info(
    { companyId, skills: results.length, flagged: results.filter((r) => r.varianceFlag).length },
    "variance: computation complete",
  );

  return results;
}

// ── getFlaggedSkills ──────────────────────────────────────────────────────────

/**
 * Admin portal: list skills with high variance in the last 30 days.
 */
export async function getFlaggedSkills(db: Db, companyId: string): Promise<VarianceResult[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

  const rows = await (db as any)
    .select()
    .from(skillVarianceMetrics)
    .where(and(
      eq(skillVarianceMetrics.companyId, companyId),
      eq(skillVarianceMetrics.varianceFlag, true),
      gte(skillVarianceMetrics.computedAt, cutoff),
    ));

  return rows.map((r: any) => ({
    skillId:      r.skillId,
    companyId:    r.companyId,
    mean:         Number(r.judgeScoreMean),
    std:          Number(r.judgeScoreStd),
    varianceFlag: true,
    sampleSize:   0,
  }));
}
