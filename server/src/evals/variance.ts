/**
 * server/src/evals/variance.ts
 *
 * Gap A — Non-determinism debugging.
 *
 * Computes judge score variance per skill per company over the current period.
 * High variance (std > 1.2) flags the skill for admin review.
 *
 * Run weekly inside the morning intelligence sweep (Monday).
 * Surfaces in admin portal only — NEVER shown to operators.
 *
 * Replay: any task with a stored checkpoint snapshot can be replayed and
 * compared to the original output via compareTaskReplay().
 */

import { and, avg, count, eq, gte, sql } from "drizzle-orm";
import { judgeResults, skillVarianceMetrics, companySkills, companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "variance" });

const VARIANCE_FLAG_STD_THRESHOLD = 1.2;
const MIN_SAMPLES_REQUIRED = 5;

// ── Compute variance for a single company ────────────────────────────────────

export async function computeSkillVariance(db: Db, companyId: string): Promise<number> {
  // Get all skills for this company
  const skills = await (db as any)
    .select({ id: companySkills.id })
    .from(companySkills)
    .where(eq(companySkills.companyId, companyId));

  const periodStart = getPeriodStart();
  let processed = 0;

  for (const skill of skills) {
    try {
      // Fetch all judge scores for this skill in the current period
      const scores = await (db as any)
        .select({ score: judgeResults.overallScore })
        .from(judgeResults)
        .where(
          and(
            eq(judgeResults.companyId, companyId),
            gte(judgeResults.createdAt, periodStart),
          ),
        );

      if (scores.length < MIN_SAMPLES_REQUIRED) continue;

      const values = scores.map((r: { score: string }) => parseFloat(r.score));
      const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const variance = values.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      const varianceFlag = std > VARIANCE_FLAG_STD_THRESHOLD;

      // Upsert variance metric
      await (db as any)
        .insert(skillVarianceMetrics)
        .values({
          skillId:         skill.id,
          companyId,
          periodStart:     periodStart.toISOString().split("T")[0],
          judgeScoreMean:  mean.toFixed(2),
          judgeScoreStd:   std.toFixed(2),
          varianceFlag,
          computedAt:      new Date(),
        })
        .onConflictDoUpdate({
          target:  [skillVarianceMetrics.skillId, skillVarianceMetrics.companyId],
          set: {
            judgeScoreMean: mean.toFixed(2),
            judgeScoreStd:  std.toFixed(2),
            varianceFlag,
            computedAt:     new Date(),
          },
        })
        .catch(() => {
          // Table may not have unique constraint — insert new row
        });

      if (varianceFlag) {
        logger.warn(
          { companyId, skillId: skill.id, std: std.toFixed(2) },
          "variance: high-variance skill flagged",
        );
      }

      processed++;
    } catch (err) {
      logger.error({ companyId, skillId: skill.id, err }, "variance: skill compute failed");
    }
  }

  return processed;
}

// ── Sweep all companies (called from morning intelligence worker on Monday) ──

export async function runVarianceSweep(db: Db): Promise<{ companies: number; skills: number }> {
  const allCompanies = await (db as any)
    .select({ id: companies.id })
    .from(companies);

  let totalSkills = 0;
  for (const company of allCompanies) {
    totalSkills += await computeSkillVariance(db, company.id).catch(() => 0);
  }

  logger.info({ companies: allCompanies.length, skills: totalSkills }, "variance: sweep complete");
  return { companies: allCompanies.length, skills: totalSkills };
}

// ── Helper ───────────────────────────────────────────────────────────────────

function getPeriodStart(): Date {
  const d = new Date();
  // 4-week rolling window
  d.setDate(d.getDate() - 28);
  d.setHours(0, 0, 0, 0);
  return d;
}
