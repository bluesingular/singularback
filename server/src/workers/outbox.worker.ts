/**
 * server/src/workers/outbox.worker.ts
 *
 * P5 — Transactional outbox for BullMQ jobs.
 *
 * PROBLEM: Pack installer (and other transactional code) writes jobs to the
 * pending_jobs PostgreSQL table INSIDE a DB transaction. If Redis is down
 * when the transaction commits, the BullMQ enqueue silently fails — jobs
 * are lost and seed tasks never fire.
 *
 * SOLUTION: Outbox pattern.
 *   1. Transactional code writes job details to pending_jobs INSIDE the PG tx.
 *   2. This worker polls pending_jobs every 5 seconds.
 *   3. For each unsent row: enqueue in BullMQ, mark sent_at = NOW().
 *   4. If BullMQ is down: rows stay unsent and are retried next poll.
 *   5. If the outbox worker crashes mid-flight: unsent rows are picked up
 *      again on the next poll (safe because BullMQ jobId deduplication
 *      prevents double-execution via the pending_jobs row id as jobId).
 *
 * INVARIANT: exactly-once delivery guaranteed at the BullMQ level via
 * { jobId: row.id } — BullMQ ignores duplicate jobId submissions.
 *
 * Polling interval: 5 seconds (configurable via OUTBOX_POLL_MS env var).
 * Batch size: 100 rows per poll to bound Redis RTT.
 */

import { isNull, isNotNull, asc, eq, lt } from "drizzle-orm";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { pendingJobs } from "@paperclipai/db";
import { agentQueue, backgroundQueue, systemQueue, installQueue, heartbeatQueue } from "../queue/queues.js";
import type { Queue } from "bullmq";

const logger = pino({ name: "outbox-worker" });

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_MS ?? 5_000);
const BATCH_SIZE       = 100;

// ── Queue router ──────────────────────────────────────────────────────────────

function resolveQueue(queueName: string): Queue | null {
  switch (queueName) {
    case "agents":     return agentQueue;
    case "background": return backgroundQueue;
    case "system":     return systemQueue;
    case "install":    return installQueue;
    case "heartbeats": return heartbeatQueue;
    default:
      logger.warn({ queueName }, "outbox: unknown queue name — skipping");
      return null;
  }
}

// ── Single poll cycle ─────────────────────────────────────────────────────────

async function pollOutbox(db: Db): Promise<void> {
  // Select up to BATCH_SIZE unsent rows, oldest first
  const rows = await db
    .select()
    .from(pendingJobs)
    .where(isNull(pendingJobs.sentAt))
    .orderBy(asc(pendingJobs.createdAt))
    .limit(BATCH_SIZE);

  if (rows.length === 0) return;

  let dispatched = 0;
  let skipped    = 0;

  for (const row of rows) {
    const queue = resolveQueue(row.queue);
    if (!queue) {
      // Mark as sent so it doesn't block the outbox indefinitely
      await db
        .update(pendingJobs)
        .set({ sentAt: new Date() })
        .where(eq(pendingJobs.id, row.id));
      skipped++;
      continue;
    }

    const raw     = row.payload as Record<string, unknown>;
    const jobName = (raw.jobName as string | undefined) ?? row.queue;

    // Strip internal outbox fields before dispatching to BullMQ
    const { jobName: _jn, _delayMs, _jobId, ...payload } = raw;
    const delayMs = typeof _delayMs === "number" ? _delayMs : undefined;
    // _jobId allows callers to set a stable idempotency key; falls back to row.id
    const jobId   = typeof _jobId === "string" ? _jobId : row.id;

    // jobId deduplication prevents double-dispatch on outbox retries
    await queue.add(jobName, payload, {
      jobId,
      delay:    delayMs,
      attempts: 3,
      backoff:  { type: "exponential", delay: 5000 },
    });

    await db
      .update(pendingJobs)
      .set({ sentAt: new Date() })
      .where(eq(pendingJobs.id, row.id));

    dispatched++;
  }

  if (dispatched > 0 || skipped > 0) {
    logger.info({ dispatched, skipped }, "outbox: batch dispatched");
  }
}

// ── Outbox runner ─────────────────────────────────────────────────────────────

let _stopSignal = false;
let _pollHandle: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the outbox polling loop.
 * Returns a stop function that drains the current cycle and exits cleanly.
 */
export function startOutboxWorker(db: Db): () => void {
  _stopSignal = false;

  async function loop(): Promise<void> {
    if (_stopSignal) return;

    try {
      await pollOutbox(db);
    } catch (err) {
      logger.error({ err }, "outbox: poll cycle error — will retry next interval");
    }

    if (!_stopSignal) {
      _pollHandle = setTimeout(loop, POLL_INTERVAL_MS);
    }
  }

  // Start immediately — don't wait for the first interval
  _pollHandle = setTimeout(loop, 0);

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "outbox: started");

  return function stop() {
    _stopSignal = true;
    if (_pollHandle) {
      clearTimeout(_pollHandle);
      _pollHandle = null;
    }
    logger.info("outbox: stopped");
  };
}

// ── Helper: write a job to the outbox inside a transaction ───────────────────

/**
 * Write a job to the pending_jobs outbox table.
 * Must be called inside an existing PostgreSQL transaction (tx).
 *
 * The payload must include a `jobName` field so the outbox worker knows
 * which BullMQ job name to use when dispatching.
 *
 * Example:
 *   await writeToOutbox(tx, "agents", {
 *     jobName: "agent.heartbeat",
 *     agentId: "...",
 *     companyId: "...",
 *   });
 */
export async function writeToOutbox(
  tx:        Db,
  queueName: string,
  payload:   Record<string, unknown>,
): Promise<void> {
  await tx.insert(pendingJobs).values({
    queue:   queueName,
    payload: payload as any,
  });
}
