/**
 * server/src/workers/taskApproved.worker.ts
 *
 * Processes task.approved jobs from the "agents" queue.
 * When an operator approves a pending action, the agent must execute it
 * immediately — not wait for the next heartbeat interval.
 *
 * G8: Also releases any downstream tasks that were blocked waiting on this task.
 *
 * RULE 7 (APPROVAL FLOW NON-NEGOTIABLE): requires_approval action →
 * approval_requests record → wait for human. This worker fires the moment
 * the human approves, ensuring zero additional delay.
 */

import { Worker, type Job } from "bullmq";
import pino from "pino";
import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { trustScores, issues as issuesTable } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { emit } from "../queue/emit.js";
import type { TaskApprovedJob } from "../queue/jobs.js";
import { releaseBlockedTasks } from "../tasks/dag.js";
import { recordApproval } from "../trust/service.js";
import type { AutonomyLevel } from "../trust/calculator.js";

const logger = pino({ name: "task-approved-worker" });

export function initTaskApprovedWorker(db: Db): Worker {
  const worker = new Worker<TaskApprovedJob>(
    "agents",
    async (job: Job<TaskApprovedJob>) => {
      if (job.name !== "task.approved") return;

      const { taskId, agentId, companyId, approvedBy, traceId } = job.data;
      const log = logger.child({ traceId, taskId, agentId, companyId });

      log.info({ approvedBy }, "task approved: triggering immediate execution");

      // Trigger immediate heartbeat so the agent acts on the approval
      await emit.heartbeat({ agentId, companyId, triggeredBy: "approval" }, 0);

      // G8: Release any downstream tasks that were blocked waiting on this task
      const released = await releaseBlockedTasks(db, taskId, companyId);
      if (released.length > 0) {
        log.info({ released }, "dag: released downstream tasks");
      }

      // ITEM 5: Record implicit approval rating (operator clicked approve = positive signal)
      // Uses the same logic as POST /issues/:id/rate but with implicit rating=5
      try {
        const [issue] = await db
          .select({ assigneeAgentId: issuesTable.assigneeAgentId, skillType: issuesTable.skillType })
          .from(issuesTable)
          .where(and(eq(issuesTable.id, taskId), eq(issuesTable.companyId, companyId)))
          .limit(1);

        if (issue?.assigneeAgentId) {
          const skillType: string = (issue as any).skillType ?? "general";
          const [existing] = await db
            .select()
            .from(trustScores)
            .where(and(eq(trustScores.agentId, issue.assigneeAgentId), eq(trustScores.skillType, skillType)))
            .limit(1);

          const currentStreak   = existing?.approvalStreak   ?? 0;
          const currentLevel    = (existing?.autonomyLevel   ?? "building") as AutonomyLevel;
          const taskCountWindow = (existing?.taskCountWindow ?? 0) + 1;
          const prevAvg         = parseFloat(existing?.qualityRatingAvg ?? "0") || 0;
          const prevCount       = existing?.taskCountWindow ?? 0;
          const qualityRatingAvg = prevCount > 0 ? (prevAvg * prevCount + 5) / taskCountWindow : 5;

          await recordApproval(db, {
            companyId, agentId: issue.assigneeAgentId, skillType,
            skillAutonomyTier: "A",
            rating: 5, gatePassed: true, schemaPassed: true,
            qualityRatingAvg,
            gatePassRate:   parseFloat(existing?.gatePassRate   ?? "1") || 1,
            schemaPassRate: parseFloat(existing?.schemaPassRate ?? "1") || 1,
            taskCountWindow, currentStreak, currentLevel,
          });
          log.info({ skillType, newStreak: currentStreak + 1 }, "trust: approval streak updated");
        }
      } catch (err) {
        log.warn({ err }, "trust: recordApproval failed — non-fatal");
      }
    },
    {
      connection: redisConnectionBlocking,
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ traceId: job?.data?.traceId, taskId: job?.data?.taskId, agentId: job?.data?.agentId, err }, "task.approved job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "task-approved worker connection error");
  });

  return worker;
}
