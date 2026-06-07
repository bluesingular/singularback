/**
 * server/src/workers/behavioralMonitoring.worker.ts
 *
 * AG-10 — Production behavioral monitoring.
 *
 * Daily sweep that:
 *   1. Finds all (companyId, skillId) pairs with 30+ judge_results
 *   2. Establishes a behavioral baseline if none exists
 *   3. Compares recent 10 results against baseline — flags anomalies if:
 *      - Any metric deviates > 2 standard deviations from baseline, OR
 *      - judge_score drops > 0.8 points from baseline average
 *
 * Anomalies surface in the admin portal only — NEVER shown directly to operators.
 *
 * RULE 6: Idempotent — running twice in the same day is a no-op because
 * baselines use upsert and anomalies are only created for unresolved deltas.
 */

import { Worker, Queue, type Job } from "bullmq";
import { and, eq, gte, desc, sql, lt } from "drizzle-orm";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { judgeResults, behavioralBaselines, behavioralAnomalies, companySkills, issues } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";

const logger = pino({ name: "behavioral-monitoring-worker" });

const SYSTEM_QUEUE_NAME   = "system";
const MONITORING_JOB_NAME = "behavioral.monitoring";
const INTERVAL_MS         = 24 * 60 * 60 * 1000; // once per day

const MIN_TASK_COUNT       = 30;   // minimum tasks before baseline is meaningful
const RECENT_WINDOW        = 10;   // compare last N tasks vs baseline
const ANOMALY_STD_THRESHOLD = 2.0; // flag if deviation > 2 std devs
const JUDGE_DROP_THRESHOLD  = 0.8; // flag if judge score drops > 0.8pts

// ── Worker ─────────────────────────────────────────────────────────────────────

export function initBehavioralMonitoringWorker(db: Db): Worker {
  const worker = new Worker(
    SYSTEM_QUEUE_NAME,
    async (job: Job) => {
      if (job.name !== MONITORING_JOB_NAME) return;

      const log = logger.child({ jobId: job.id });
      log.info("behavioral-monitoring: sweep started");

      // 1. Find all (company, skillType) pairs with MIN_TASK_COUNT+ judge results.
      //    judge_results has no skill_id — join through issues.skill_type → companySkills.
      const eligibleSkills = await (db as any).execute(sql`
        SELECT
          jr.company_id,
          i.skill_type,
          COUNT(*)::int                             AS total_count,
          AVG(jr.overall_score::numeric)            AS avg_score,
          STDDEV(jr.overall_score::numeric)         AS std_score,
          AVG(jr.auto_recycled::int)                AS recycle_rate
        FROM judge_results jr
        JOIN issues i ON i.id = jr.task_id
        WHERE i.skill_type IS NOT NULL
        GROUP BY jr.company_id, i.skill_type
        HAVING COUNT(*) >= ${MIN_TASK_COUNT}
      `);

      const rows: Array<{
        company_id:   string;
        skill_type:   string;
        total_count:  number;
        avg_score:    string;
        std_score:    string;
        recycle_rate: string;
      }> = Array.isArray(eligibleSkills)
        ? eligibleSkills
        : (eligibleSkills as any).rows ?? [];

      log.info({ skillPairCount: rows.length }, "behavioral-monitoring: eligible skill pairs found");

      let baselinesEstablished = 0;
      let anomaliesDetected    = 0;

      for (const row of rows) {
        const companyId = row.company_id;
        const skillType = row.skill_type;

        // Resolve companySkills.id from slug (skill_type == slug)
        const [skillRecord] = await db
          .select({ id: companySkills.id })
          .from(companySkills)
          .where(and(eq(companySkills.companyId, companyId), eq(companySkills.slug, skillType)))
          .limit(1);

        if (!skillRecord) continue;
        const skillId = skillRecord.id;
        const avgScore  = parseFloat(row.avg_score ?? "0");
        const stdScore  = parseFloat(row.std_score ?? "0");
        const recycleRate = parseFloat(row.recycle_rate ?? "0");

        // 2. Upsert baseline
        const existingBaseline = await db
          .select({ id: behavioralBaselines.id, avgJudgeScore: behavioralBaselines.avgJudgeScore })
          .from(behavioralBaselines)
          .where(
            and(
              eq(behavioralBaselines.companyId, companyId),
              eq(behavioralBaselines.skillId, skillId),
            ),
          )
          .limit(1);

        if (existingBaseline.length === 0) {
          await db.insert(behavioralBaselines).values({
            companyId,
            skillId,
            avgJudgeScore:     String(avgScore.toFixed(2)),
            avgOutputTokens:   null,
            avgToolCalls:      null,
            avgExecutionMs:    null,
            approvalRate:      null,
            recycleRate:       String(recycleRate.toFixed(3)),
            baselineTaskCount: row.total_count,
            establishedAt:     new Date(),
          });
          baselinesEstablished++;
          log.info({ companyId, skillId, avgScore, baselineTaskCount: row.total_count }, "behavioral-monitoring: baseline established");
          continue; // skip anomaly check for new baselines
        }

        const baselineAvg = parseFloat(existingBaseline[0]?.avgJudgeScore as string ?? "0");

        // 3. Get recent RECENT_WINDOW results — join through issues to filter by skillType
        const recentResults = await (db as any).execute(sql`
          SELECT jr.overall_score, jr.auto_recycled
          FROM judge_results jr
          JOIN issues i ON i.id = jr.task_id
          WHERE jr.company_id = ${companyId}
            AND i.skill_type = ${skillType}
          ORDER BY jr.created_at DESC
          LIMIT ${RECENT_WINDOW}
        `);
        const recentRows: Array<{ overall_score: string; auto_recycled: boolean }> =
          Array.isArray(recentResults) ? recentResults : (recentResults as any).rows ?? [];

        if (recentRows.length < RECENT_WINDOW) continue;

        const recentScores = recentRows.map((r) => parseFloat(r.overall_score ?? "0"));
        const recentAvg    = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

        const drop = baselineAvg - recentAvg;

        // 4. Check for judge score anomaly
        if (drop > JUDGE_DROP_THRESHOLD || (stdScore > 0 && drop / stdScore > ANOMALY_STD_THRESHOLD)) {
          // Check for unresolved anomaly of this type to avoid duplicates
          const existing = await db
            .select({ id: behavioralAnomalies.id })
            .from(behavioralAnomalies)
            .where(
              and(
                eq(behavioralAnomalies.companyId, companyId),
                eq(behavioralAnomalies.skillId, skillId),
                eq(behavioralAnomalies.metric, "avg_judge_score"),
                eq(behavioralAnomalies.resolved, false),
              ),
            )
            .limit(1);

          if (existing.length === 0) {
            const deviationPct = baselineAvg > 0 ? ((drop / baselineAvg) * 100) : 0;
            const severity     = drop > 1.5 ? "high" : drop > JUDGE_DROP_THRESHOLD ? "medium" : "low";

            await db.insert(behavioralAnomalies).values({
              companyId,
              skillId,
              metric:       "avg_judge_score",
              baselineVal:  String(baselineAvg.toFixed(4)),
              currentVal:   String(recentAvg.toFixed(4)),
              deviationPct: String(deviationPct.toFixed(2)),
              severity,
              resolved:     false,
              detectedAt:   new Date(),
            });

            anomaliesDetected++;
            log.warn(
              { companyId, skillId, baselineAvg, recentAvg, drop, severity },
              "behavioral-monitoring: judge score anomaly detected",
            );
          }
        }

        // 5. Check recycle rate anomaly
        const recentRecycleRate = recentRows.filter((r) => r.auto_recycled).length / recentRows.length;
        const baselineRecycleRate = recycleRate;
        const recycleDelta = recentRecycleRate - baselineRecycleRate;

        if (recycleDelta > 0.3 && stdScore > 0) { // recycle rate jumped by 30%+
          const existing = await db
            .select({ id: behavioralAnomalies.id })
            .from(behavioralAnomalies)
            .where(
              and(
                eq(behavioralAnomalies.companyId, companyId),
                eq(behavioralAnomalies.skillId, skillId),
                eq(behavioralAnomalies.metric, "recycle_rate"),
                eq(behavioralAnomalies.resolved, false),
              ),
            )
            .limit(1);

          if (existing.length === 0) {
            await db.insert(behavioralAnomalies).values({
              companyId,
              skillId,
              metric:       "recycle_rate",
              baselineVal:  String(baselineRecycleRate.toFixed(4)),
              currentVal:   String(recentRecycleRate.toFixed(4)),
              deviationPct: String((recycleDelta * 100).toFixed(2)),
              severity:     "medium",
              resolved:     false,
              detectedAt:   new Date(),
            });
            anomaliesDetected++;
            log.warn({ companyId, skillId, baselineRecycleRate, recentRecycleRate }, "behavioral-monitoring: recycle rate anomaly");
          }
        }
      }

      // 6. Refresh baselines every 90 days (rolling update)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
      await db
        .delete(behavioralBaselines)
        .where(lt(behavioralBaselines.establishedAt, ninetyDaysAgo));

      log.info({ baselinesEstablished, anomaliesDetected }, "behavioral-monitoring: sweep complete");
    },
    { connection: redisConnectionBlocking, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "behavioral-monitoring: job failed");
  });
  worker.on("error", (err) => {
    logger.error({ err }, "behavioral-monitoring: worker connection error");
  });

  return worker;
}

// ── Scheduler ──────────────────────────────────────────────────────────────────

export async function scheduleBehavioralMonitoring(): Promise<void> {
  const systemQueue = new Queue(SYSTEM_QUEUE_NAME, { connection: redisConnectionBlocking });

  await systemQueue.upsertJobScheduler(
    `${MONITORING_JOB_NAME}.scheduler`,
    { every: INTERVAL_MS },
    {
      name: MONITORING_JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: { count: 7 },
        removeOnFail:     { count: 30 },
      },
    },
  );

  logger.info("behavioral-monitoring: daily sweep scheduled");
}
