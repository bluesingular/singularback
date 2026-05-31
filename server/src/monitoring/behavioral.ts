/**
 * server/src/monitoring/behavioral.ts
 *
 * AG-10 — Production behavioral monitoring.
 *
 * Establishes per-skill baselines after 30+ tasks and detects anomalies
 * when metrics deviate > 2 standard deviations or judge score drops > 0.8pts.
 *
 * Surface to admin portal only — never alert operators directly.
 * Baselines refreshed every 90 days.
 *
 * Called by:
 *   - morningIntelligence.worker after daily job batch
 *   - POST /admin/monitoring/refresh (manual trigger from admin portal)
 */

import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  behavioralBaselines,
  behavioralAnomalies,
  judgeResults,
  issues,
} from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "behavioral-monitoring" });

const BASELINE_MIN_TASKS       = 30;
const ANOMALY_STD_THRESHOLD    = 2.0;  // deviations beyond which we flag
const ANOMALY_SCORE_DROP       = 0.8;  // judge score drop that always flags
const BASELINE_REFRESH_DAYS    = 90;

export interface BaselineMetrics {
  avgJudgeScore:    number;
  avgOutputTokens:  number;
  avgToolCalls:     number;
  avgExecutionMs:   number;
  approvalRate:     number;
  recycleRate:      number;
  taskCount:        number;
}

// ── refreshBaselines ─────────────────────────────────────────────────────────

/**
 * Recompute baselines for all skills in a company that have ≥30 tasks.
 * Refreshes at most every 90 days (skips if recently established).
 */
export async function refreshBaselines(db: Db, companyId: string): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BASELINE_REFRESH_DAYS);

  // Find skills that haven't had a baseline refresh recently
  const skillRows = await (db as any)
    .select({
      skillId:   judgeResults.taskId,  // we'll join to get skill_id below
      taskCount: sql`count(distinct ${issues.id})`,
    })
    .from(issues)
    .innerJoin(judgeResults, eq(judgeResults.taskId, issues.id))
    .where(and(
      eq(issues.companyId, companyId),
      gte(issues.createdAt, sql`NOW() - INTERVAL '90 days'`),
    ))
    .groupBy((issues as any).skillId)
    .having(sql`count(distinct ${issues.id}) >= ${BASELINE_MIN_TASKS}`);

  let refreshed = 0;

  for (const row of skillRows) {
    const skillId = (row as any).skillId;
    if (!skillId) continue;

    // Check if we refreshed this baseline recently
    const existing = await (db as any)
      .select({ establishedAt: behavioralBaselines.establishedAt })
      .from(behavioralBaselines)
      .where(and(
        eq(behavioralBaselines.companyId, companyId),
        eq(behavioralBaselines.skillId, skillId),
      ))
      .limit(1);

    if (existing.length > 0 && existing[0].establishedAt > cutoff) continue;

    const metrics = await computeMetrics(db, companyId, skillId);
    if (!metrics) continue;

    await (db as any)
      .insert(behavioralBaselines)
      .values({
        skillId,
        companyId,
        avgJudgeScore:    String(metrics.avgJudgeScore.toFixed(2)),
        avgOutputTokens:  metrics.avgOutputTokens,
        avgToolCalls:     String(metrics.avgToolCalls.toFixed(2)),
        avgExecutionMs:   metrics.avgExecutionMs,
        approvalRate:     String(metrics.approvalRate.toFixed(3)),
        recycleRate:      String(metrics.recycleRate.toFixed(3)),
        baselineTaskCount: metrics.taskCount,
      })
      .onConflictDoUpdate({
        target: [behavioralBaselines.skillId, behavioralBaselines.companyId],
        set: {
          avgJudgeScore:    String(metrics.avgJudgeScore.toFixed(2)),
          avgOutputTokens:  metrics.avgOutputTokens,
          avgToolCalls:     String(metrics.avgToolCalls.toFixed(2)),
          avgExecutionMs:   metrics.avgExecutionMs,
          approvalRate:     String(metrics.approvalRate.toFixed(3)),
          recycleRate:      String(metrics.recycleRate.toFixed(3)),
          baselineTaskCount: metrics.taskCount,
          establishedAt:    new Date(),
        },
      });

    refreshed++;
  }

  logger.info({ companyId, refreshed }, "behavioral-monitoring: baselines refreshed");
  return refreshed;
}

// ── detectAnomalies ───────────────────────────────────────────────────────────

/**
 * Compare recent metrics (last 7 days) against the established baseline.
 * Write behavioral_anomalies rows for anything that exceeds thresholds.
 * Returns count of new anomalies detected.
 */
export async function detectAnomalies(db: Db, companyId: string): Promise<number> {
  const baselines = await (db as any)
    .select()
    .from(behavioralBaselines)
    .where(eq(behavioralBaselines.companyId, companyId));

  let detected = 0;

  for (const baseline of baselines) {
    const recent = await computeMetrics(db, companyId, baseline.skillId, 7);
    if (!recent || recent.taskCount < 5) continue;

    const checks: Array<{ metric: string; baseline: number; current: number }> = [
      { metric: "avg_judge_score",   baseline: Number(baseline.avgJudgeScore),  current: recent.avgJudgeScore  },
      { metric: "approval_rate",     baseline: Number(baseline.approvalRate),   current: recent.approvalRate   },
      { metric: "recycle_rate",      baseline: Number(baseline.recycleRate),    current: recent.recycleRate    },
      { metric: "avg_execution_ms",  baseline: Number(baseline.avgExecutionMs), current: recent.avgExecutionMs },
    ];

    for (const { metric, baseline: bval, current } of checks) {
      if (bval === 0) continue;

      const deviationPct = Math.abs((current - bval) / bval) * 100;

      // Special rule: judge score drop > 0.8 always flags as high severity
      const isScoreDrop = metric === "avg_judge_score" && (bval - current) > ANOMALY_SCORE_DROP;
      const exceedsStd  = deviationPct > (ANOMALY_STD_THRESHOLD * 15); // ~30% deviation as proxy for 2σ

      if (!isScoreDrop && !exceedsStd) continue;

      const severity = isScoreDrop || deviationPct > 50 ? "high" : deviationPct > 30 ? "medium" : "low";

      // Check if unresolved anomaly for this metric already exists
      const existing = await (db as any)
        .select({ id: behavioralAnomalies.id })
        .from(behavioralAnomalies)
        .where(and(
          eq(behavioralAnomalies.companyId, companyId),
          eq(behavioralAnomalies.skillId, baseline.skillId),
          eq(behavioralAnomalies.metric, metric),
          eq(behavioralAnomalies.resolved, false),
        ))
        .limit(1);

      if (existing.length > 0) continue;

      await (db as any).insert(behavioralAnomalies).values({
        skillId:      baseline.skillId,
        companyId,
        metric,
        baselineVal:  String(bval.toFixed(4)),
        currentVal:   String(current.toFixed(4)),
        deviationPct: String(deviationPct.toFixed(2)),
        severity,
      });

      detected++;
      logger.warn(
        { companyId, skillId: baseline.skillId, metric, deviationPct: deviationPct.toFixed(1), severity },
        "behavioral-monitoring: anomaly detected",
      );
    }
  }

  return detected;
}

// ── computeMetrics ────────────────────────────────────────────────────────────

async function computeMetrics(
  db: Db,
  companyId: string,
  skillId: string,
  days = 90,
): Promise<BaselineMetrics | null> {
  const rows = await (db as any)
    .select({
      avgJudgeScore:  sql`avg(jr.overall_score::numeric)`,
      avgOutputTokens: sql`avg(i.output_tokens)`,
      avgToolCalls:   sql`avg(0)`,   // placeholder until tool_call count is tracked
      avgExecutionMs: sql`avg(extract(epoch from (i.updated_at - i.created_at)) * 1000)`,
      approvalRate:   sql`avg(case when i.status = 'completed' and i.approved_by is not null then 1.0 else 0.0 end)`,
      recycleRate:    sql`avg(case when jr.auto_recycled = true then 1.0 else 0.0 end)`,
      taskCount:      sql`count(distinct i.id)`,
    })
    .from(issues)
    .leftJoin(judgeResults, eq(judgeResults.taskId, issues.id))
    .where(and(
      eq(issues.companyId, companyId),
      eq((issues as any).skillId, skillId),
      gte(issues.createdAt, sql`NOW() - INTERVAL '${sql.raw(String(days))} days'`),
    ));

  const row = rows[0];
  if (!row || Number(row.taskCount) === 0) return null;

  return {
    avgJudgeScore:   Number(row.avgJudgeScore ?? 0),
    avgOutputTokens: Math.round(Number(row.avgOutputTokens ?? 0)),
    avgToolCalls:    Number(row.avgToolCalls ?? 0),
    avgExecutionMs:  Math.round(Number(row.avgExecutionMs ?? 0)),
    approvalRate:    Number(row.approvalRate ?? 0),
    recycleRate:     Number(row.recycleRate ?? 0),
    taskCount:       Number(row.taskCount),
  };
}
