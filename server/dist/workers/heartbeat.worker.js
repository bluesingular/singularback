/**
 * server/src/workers/heartbeat.worker.ts
 *
 * Processes heartbeat jobs from the "agents" queue.
 * Replaces Paperclip's setInterval polling loop: instead of tickTimers()
 * checking all agents every N seconds, each agent has its own BullMQ job
 * that reschedules itself after execution based on the agent's configured
 * heartbeat interval.
 *
 * Idempotency: BullMQ deduplicates via jobId=heartbeat:{agentId}, so only
 * one pending heartbeat per agent exists at any time. If the job runs twice
 * (retry after failure), wakeup() is safe to call again — it checks agent
 * state and skips if concurrency limit is already at max.
 */
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import pino from "pino";
import { redisConnectionBlocking } from "../queue/redis.js";
import { emit } from "../queue/emit.js";
import { heartbeatService } from "../services/heartbeat.js";
const logger = pino({ name: "heartbeat-worker" });
// Heartbeat workers are stateless — each job instantiates a fresh service
// bound to the shared db. The db import is lazy to avoid circular deps.
async function getDb() {
    const { db } = await import("../db.js");
    return db;
}
async function processHeartbeat(job) {
    const { agentId, companyId, triggeredBy } = job.data;
    const db = await getDb();
    const agents = (await import("@paperclipai/db")).agents;
    const svc = heartbeatService(db);
    // Load agent to check status and get heartbeat policy
    const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);
    if (!agent) {
        // Agent deleted — safe exit, don't reschedule
        logger.info({ agentId }, "heartbeat: agent not found, skipping");
        return;
    }
    if (agent.status === "paused" || agent.status === "terminated") {
        // Don't reschedule — heartbeat will be re-added when agent is unpaused
        logger.debug({ agentId, status: agent.status }, "heartbeat: agent not active, skipping");
        return;
    }
    // Execute the heartbeat (delegates to Paperclip's existing execution engine)
    await svc.wakeup(agentId, {
        source: triggeredBy === "scheduler" ? "timer" : "on_demand",
        triggerDetail: "system",
        reason: `heartbeat_${triggeredBy}`,
        requestedByActorType: "system",
        requestedByActorId: "bullmq_heartbeat_worker",
        contextSnapshot: { triggeredBy, jobId: job.id },
    });
    // Re-schedule next heartbeat based on agent's configured interval.
    // Parse the heartbeat policy from runtimeConfig (same logic as tickTimers).
    const runtimeConfig = (agent.runtimeConfig ?? {});
    const heartbeatCfg = (runtimeConfig.heartbeat != null && typeof runtimeConfig.heartbeat === "object"
        ? runtimeConfig.heartbeat
        : {});
    const enabled = Boolean(heartbeatCfg.enabled ?? true);
    const intervalSec = Math.max(0, Number(heartbeatCfg.intervalSec ?? 0));
    if (enabled && intervalSec > 0) {
        await emit.heartbeat({ agentId, companyId, triggeredBy: "scheduler" }, intervalSec * 1000);
    }
}
export const heartbeatWorker = new Worker("agents", async (job) => {
    if (job.name !== "heartbeat")
        return; // this worker only handles heartbeat jobs
    await processHeartbeat(job);
}, {
    connection: redisConnectionBlocking,
    concurrency: 20,
});
heartbeatWorker.on("failed", (job, err) => {
    logger.error({ agentId: job?.data?.agentId, jobId: job?.id, err }, "heartbeat job failed");
    // Failed jobs are retained for 7 days (see queues.ts removeOnFail).
    // Monitor via Bull Board at /internal/queues.
});
heartbeatWorker.on("error", (err) => {
    logger.error({ err }, "heartbeat worker connection error");
});
//# sourceMappingURL=heartbeat.worker.js.map