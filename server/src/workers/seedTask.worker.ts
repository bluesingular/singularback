/**
 * server/src/workers/seedTask.worker.ts
 *
 * Processes "seed.task" jobs from the "install" queue.
 *
 * Uses a dedicated "install" queue (not the shared "agents" queue) to ensure
 * seed.task jobs are never stolen by emailReceived / taskApproved workers
 * that compete on the "agents" queue (BullMQ is work-stealing — any worker
 * on the same queue can pick up any job).
 *
 * The pack installer enqueues seed.task jobs immediately after installation
 * (with optional delay). This worker creates the actual issue in the DB so
 * the agent's heartbeat can pick it up and execute it.
 *
 * Job payload: { companyId, agentSlug, title, body }
 *
 * Flow:
 *   1. Look up agent by slug + companyId
 *   2. Insert issue into DB assigned to that agent
 *   3. Trigger an immediate heartbeat so the agent starts right away
 *
 * RULE 6: idempotent — jobId is "seed-{companyId}-{agentSlug}-{i}"
 * so duplicate jobs are silently ignored by BullMQ.
 */

import { Worker, type Job } from "bullmq";
import { eq, and, sql, desc } from "drizzle-orm";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { agents, issues, companies } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { emit } from "../queue/emit.js";

const logger = pino({ name: "seed-task-worker" });

interface SeedTaskJob {
  companyId: string;
  agentSlug: string;
  title:     string;
  body?:     string;
}

export function initSeedTaskWorker(db: Db): Worker {
  const worker = new Worker<SeedTaskJob>(
    "install",
    async (job: Job<SeedTaskJob>) => {
      const { companyId, agentSlug, title, body, traceId } = job.data as SeedTaskJob & { traceId?: string };
      const log = logger.child({ traceId, companyId, agentSlug });

      log.info({ title }, "seed-task: processing");

      // 1. Look up agent by slug
      const [agent] = await db
        .select({ id: agents.id, name: agents.name, status: agents.status })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.slug, agentSlug)))
        .limit(1);

      if (!agent) {
        log.warn("seed-task: agent not found — skipping");
        return;
      }

      if (agent.status === "deactivated") {
        log.warn("seed-task: agent deactivated — skipping");
        return;
      }

      // 2. Build issue number + identifier (same logic as issueService.create)
      const [maxRow] = await db
        .select({ maxNum: sql<number>`coalesce(max(${issues.issueNumber}), 0)` })
        .from(issues)
        .where(eq(issues.companyId, companyId));

      const currentMax = maxRow?.maxNum ?? 0;

      const [company] = await db
        .update(companies)
        .set({
          issueCounter: sql`greatest(${companies.issueCounter}, ${currentMax}) + 1`,
        })
        .where(eq(companies.id, companyId))
        .returning({ issueCounter: companies.issueCounter, issuePrefix: companies.issuePrefix });

      if (!company) {
        log.error("seed-task: company not found");
        return;
      }

      const issueNumber = company.issueCounter;
      const identifier  = `${company.issuePrefix}-${issueNumber}`;

      // 3. Insert the issue as backlog — heartbeat will pick it up
      const [issue] = await db
        .insert(issues)
        .values({
          companyId,
          assigneeAgentId: agent.id,
          title,
          description:     body ?? null,
          status:          "backlog",
          priority:        "medium",
          originKind:      "seed",
          issueNumber,
          identifier,
        })
        .returning({ id: issues.id });

      log.info({ issueId: issue.id, identifier }, "seed-task: issue created");

      // 4. Trigger immediate heartbeat so the agent starts without waiting
      await emit.heartbeat({ agentId: agent.id, companyId, triggeredBy: "manual" }, 0);

      log.info({ agentId: agent.id }, "seed-task: heartbeat triggered");
    },
    {
      connection:  redisConnectionBlocking,
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, traceId: (job?.data as any)?.traceId, agentSlug: job?.data?.agentSlug, companyId: job?.data?.companyId, err }, "seed-task: job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "seed-task: worker connection error");
  });

  return worker;
}
