/**
 * server/src/queue/scheduler.ts
 *
 * Scheduler bootstrap — called once on server start.
 * Seeds BullMQ heartbeat jobs for all active agents and schedules monthly
 * cost resets for all active companies.
 *
 * This replaces Paperclip's setInterval(tickTimers) polling loop. Instead
 * of checking all agents every N seconds, each agent has its own BullMQ
 * job that reschedules itself after execution via BullMQ.
 */

import { eq } from "drizzle-orm";
import { agents, companies } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { agentQueue } from "./queues.js";
import { emit } from "./emit.js";
import pino from "pino";

const logger = pino({ name: "scheduler" });

export async function bootstrapScheduler(db: Db): Promise<void> {
  // 1. Schedule monthly cost resets for all active companies
  const activeCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.status, "active"));

  for (const company of activeCompanies) {
    await emit.scheduleMonthlyReset(company.id);
  }

  logger.info(
    { count: activeCompanies.length },
    "scheduler: monthly cost resets registered",
  );

  // 2. Seed heartbeat jobs for all active agents that don't already have one
  //    pending. BullMQ's jobId deduplication means this is safe to call on
  //    every restart — existing pending jobs are left untouched.
  const activeAgents = await db
    .select({
      id: agents.id,
      companyId: agents.companyId,
      status: agents.status,
      runtimeConfig: agents.runtimeConfig,
    })
    .from(agents)
    .where(eq(agents.status, "active"));

  let seeded = 0;
  let skipped = 0;

  for (const agent of activeAgents) {
    // Guard: only schedule heartbeats for truly active agents
    // (belt-and-suspenders in case DB filter returns stale data)
    if (agent.status !== "active") {
      skipped++;
      continue;
    }

    // Check if a heartbeat job already exists (BullMQ jobId deduplication)
    const existing = await agentQueue.getJob(`heartbeat:${agent.id}`);
    if (existing) {
      skipped++;
      continue;
    }

    // Parse heartbeat policy from runtimeConfig
    const runtimeConfig = (agent.runtimeConfig ?? {}) as Record<string, unknown>;
    const heartbeatCfg = (
      runtimeConfig.heartbeat != null && typeof runtimeConfig.heartbeat === "object"
        ? runtimeConfig.heartbeat
        : {}
    ) as Record<string, unknown>;

    const enabled = Boolean(heartbeatCfg.enabled ?? true);
    const intervalSec = Math.max(0, Number(heartbeatCfg.intervalSec ?? 0));

    if (!enabled || intervalSec <= 0) {
      skipped++;
      continue;
    }

    await emit.heartbeat(
      { agentId: agent.id, companyId: agent.companyId, triggeredBy: "scheduler" },
      0, // run immediately on startup
    );
    seeded++;
  }

  logger.info(
    { total: activeAgents.length, seeded, skipped },
    "scheduler: heartbeat jobs bootstrapped",
  );
}

/**
 * Gracefully close all queue connections on shutdown.
 * Call this in the process exit handler.
 */
export async function shutdownScheduler(): Promise<void> {
  const { agentQueue, backgroundQueue, systemQueue } = await import("./queues.js");
  await Promise.allSettled([
    agentQueue.close(),
    backgroundQueue.close(),
    systemQueue.close(),
  ]);
  logger.info("scheduler: queues closed");
}
