/**
 * server/src/workers/fleetSnapshot.worker.ts
 *
 * Gap O — Agent fleet registry snapshot worker.
 *
 * Fires every 6 hours via a BullMQ repeatable job.
 * Computes and persists a FleetSnapshot; retains the 48 most recent (8 days).
 *
 * Call scheduleFleetSnapshot() once at server startup.
 * Safe to call multiple times — BullMQ deduplicates by jobId.
 */

import { Worker, type Job } from "bullmq";
import pino from "pino";
import type { Db } from "@paperclipai/db";
import { redisConnectionBlocking } from "../queue/redis.js";
import { systemQueue } from "../queue/queues.js";
import { computeAndPersistFleetSnapshot } from "../fleet/snapshot.js";

const logger = pino({ name: "fleet-snapshot-worker" });

export function initFleetSnapshotWorker(db: Db): Worker {
  const worker = new Worker(
    "system",
    async (job: Job) => {
      if (job.name !== "fleet.snapshot") return;
      const log = logger.child({ jobId: job.id });
      try {
        await computeAndPersistFleetSnapshot(db);
        log.info("fleet-snapshot: snapshot persisted");
      } catch (err) {
        log.error({ err }, "fleet-snapshot: snapshot failed");
        throw err;
      }
    },
    { connection: redisConnectionBlocking, concurrency: 1 },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "fleet-snapshot: job failed");
  });

  return worker;
}

export async function scheduleFleetSnapshot(): Promise<void> {
  await systemQueue.add(
    "fleet.snapshot",
    {},
    {
      repeat: { pattern: "0 */6 * * *" },  // every 6 hours at :00
      jobId:  "fleet-snapshot-6h",
    },
  );
  logger.info("fleet-snapshot: 6-hourly schedule registered");
}
