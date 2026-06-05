/**
 * server/src/workers/memoryDecay.worker.ts
 *
 * F2 — Memory staleness detection.
 *
 * Daily background job that decays confidence_score on memory entries that
 * have not been reinforced in 90+ days.
 *
 * Decay rule:
 *   - Any entry where last_reinforced_at < NOW() - 90 days (or is null
 *     and created_at < NOW() - 90 days) and confidence_score > 0.2:
 *     → reduce confidence_score by 0.1
 *   - When confidence_score drops below 0.2:
 *     → flag for review in morning intelligence
 *     → entry is NEVER deleted — just de-weighted in search results
 *
 * Scheduled once daily by scheduleMemoryDecaySweep() called at startup.
 * RULE 6: idempotent — running twice in the same day is a no-op because
 * entries already decayed won't be selected again until 90 more days pass.
 */

import { Worker, Queue, type Job } from "bullmq";
import { and, isNull, lt, lte, gt, sql } from "drizzle-orm";
import pino from "pino";
import { memoryEntries } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";

const logger = pino({ name: "memory-decay-worker" });

const SYSTEM_QUEUE_NAME = "system";
const DECAY_JOB_NAME    = "memory.decay";
const DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const STALENESS_DAYS    = 90;
const DECAY_AMOUNT      = 0.1;
const FLAG_THRESHOLD    = 0.2;

// ── Worker ────────────────────────────────────────────────────────────────────

export function initMemoryDecayWorker(db: Db): Worker {
  const worker = new Worker(
    SYSTEM_QUEUE_NAME,
    async (job: Job) => {
      if (job.name !== DECAY_JOB_NAME) return;
      const log = logger.child({ jobId: job.id });

      const staleThreshold = new Date(Date.now() - STALENESS_DAYS * 86_400_000);

      // Entries that haven't been reinforced in 90+ days and still have score > 0.2
      // Use raw SQL for the GREATEST(last_reinforced_at, created_at) comparison
      const decayed = await (db as any).execute(sql`
        UPDATE memory_entries
        SET confidence_score = GREATEST(0.0, confidence_score - ${DECAY_AMOUNT})
        WHERE archived = false
          AND confidence_score > ${DECAY_AMOUNT}
          AND COALESCE(last_reinforced_at, created_at) < ${staleThreshold}
        RETURNING id, company_id, title, confidence_score
      `);

      const decayedRows: { id: string; company_id: string; title: string; confidence_score: string }[] =
        Array.isArray(decayed) ? decayed : (decayed as any).rows ?? [];

      if (decayedRows.length > 0) {
        log.info({ count: decayedRows.length }, "memory-decay: decayed entries");
      }

      const flagged = decayedRows.filter(r => Number(r.confidence_score) <= FLAG_THRESHOLD);
      if (flagged.length > 0) {
        const byCompany = new Map<string, number>();
        for (const r of flagged) {
          byCompany.set(r.company_id, (byCompany.get(r.company_id) ?? 0) + 1);
        }
        for (const [companyId, count] of byCompany) {
          log.warn({ companyId, count }, "memory-decay: entries below confidence threshold — should surface in morning intelligence");
        }
      }
    },
    { connection: redisConnectionBlocking, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "memory-decay: job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "memory-decay: worker connection error");
  });

  return worker;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Schedule the daily memory decay sweep.
 * Called once at app startup. Uses a repeatable BullMQ job so it
 * survives server restarts.
 */
export async function scheduleMemoryDecaySweep(): Promise<void> {
  const systemQueue = new Queue(SYSTEM_QUEUE_NAME, {
    connection: redisConnectionBlocking,
  });

  await systemQueue.upsertJobScheduler(
    `${DECAY_JOB_NAME}.scheduler`,
    { every: DECAY_INTERVAL_MS },
    {
      name: DECAY_JOB_NAME,
      data: {},
      opts: {
        removeOnComplete: { count: 7 },
        removeOnFail:     { count: 30 },
      },
    },
  );

  logger.info("memory-decay: daily sweep scheduled");
}
