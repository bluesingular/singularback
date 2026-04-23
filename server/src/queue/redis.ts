/**
 * server/src/queue/redis.ts
 *
 * Shared Redis connections for BullMQ.
 * Two connections are required: one for Queue operations (enqueue/inspect),
 * and one for Worker blocking operations (BRPOP/BLPOP streams).
 */

import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  tls: redisUrl.startsWith("rediss://") ? {} : undefined,
  lazyConnect: true,
});

// Separate connection for blocking operations (BullMQ requirement — workers
// use BRPOP which blocks the connection; cannot share with the Queue connection)
export const redisConnectionBlocking = redisConnection.duplicate();
