/**
 * server/src/workers/webhookReceived.worker.ts
 *
 * Processes webhook.received jobs from the "agents" queue.
 *
 * For each routing rule (first-match-wins):
 *   1. Evaluate optional condition against the payload
 *   2. Dispatch action: heartbeat → emit.heartbeat(); log_only → log only
 *
 * Updates webhook_events.status to "processed" when done.
 */

import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import pino from "pino";
import { redisConnectionBlocking } from "../queue/redis.js";
import { emit } from "../queue/emit.js";
import type { WebhookReceivedJob, RoutingRule } from "../queue/jobs.js";
import { webhookEvents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

const logger = pino({ name: "webhook-received-worker" });

// ── Condition evaluation ──────────────────────────────────────────────────────

function getNestedValue(payload: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((obj, key) => {
    if (obj != null && typeof obj === "object") {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

function matchesCondition(
  condition: RoutingRule["condition"],
  payload: Record<string, unknown>,
): boolean {
  if (!condition) return true; // no condition = always match

  const value = getNestedValue(payload, condition.field);

  switch (condition.op) {
    case "exists":
      return value !== undefined && value !== null;
    case "eq":
      return String(value) === condition.value;
    case "contains":
      return typeof value === "string" && value.includes(condition.value ?? "");
    default:
      return false;
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────

export function initWebhookReceivedWorker(db: Db): Worker {
  const worker = new Worker<WebhookReceivedJob>(
  "agents",
  async (job: Job<WebhookReceivedJob>) => {
    if (job.name !== "webhook.received") return;

    const { endpointId, companyId, routingRules, payload, source } = job.data;

    logger.info({ endpointId, companyId, source, ruleCount: routingRules.length }, "webhook: processing job");
    let dispatched = false;

    for (const rule of routingRules) {
      if (!matchesCondition(rule.condition, payload)) continue;

      if (rule.action.type === "heartbeat") {
        if (!rule.action.agentId) {
          logger.warn({ endpointId, companyId }, "webhook: heartbeat rule missing agentId — skipping");
          continue;
        }
        await emit.heartbeat(
          { agentId: rule.action.agentId, companyId, triggeredBy: "webhook" },
          0,
        );
        logger.info({ agentId: rule.action.agentId, endpointId }, "webhook: heartbeat dispatched");
      } else {
        logger.info({ endpointId, companyId, action: rule.action.type }, "webhook: log_only rule matched");
      }

      dispatched = true;
      break; // first matching rule wins
    }

    if (!dispatched && routingRules.length > 0) {
      logger.info({ endpointId, companyId }, "webhook: no rule matched — event stored only");
    }

    // Mark the most recent queued event for this company+source as processed.
    // We use a best-effort update; failing here doesn't block the job.
    try {
      await db
        .update(webhookEvents)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(webhookEvents.companyId, companyId));
    } catch (err) {
      logger.warn({ err, companyId }, "webhook: could not update event status");
    }
  },
  {
    connection: redisConnectionBlocking,
    concurrency: 20,
  },
);

  worker.on("failed", (job, err) => {
    logger.error(
      { endpointId: job?.data?.endpointId, companyId: job?.data?.companyId, err },
      "webhook.received job failed",
    );
  });

  worker.on("error", (err) => {
    logger.error({ err }, "webhook-received worker connection error");
  });

  return worker;
}
