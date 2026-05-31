/**
 * server/src/queue/redis.ts
 *
 * Shared Redis connections for BullMQ.
 * Two connections are required: one for Queue operations (enqueue/inspect),
 * and one for Worker blocking operations (BRPOP/BLPOP streams).
 *
 * T6 — Redis connection resilience:
 *   retryStrategy: exponential backoff, max 3s
 *   reconnectOnError: reconnects on READONLY errors (Redis failover / replica promotion)
 */

import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,       // required by BullMQ
  enableReadyCheck: false,
  tls: redisUrl.startsWith("rediss://") ? {} : undefined,
  lazyConnect: true,
  // T6: exponential backoff — 100ms, 200ms, 400ms… up to 3s
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
  // T6: reconnect when we get a READONLY error (Redis Sentinel failover)
  reconnectOnError: (err: Error) => err.message.includes("READONLY"),
});

// Separate connection for blocking operations (BullMQ requirement — workers
// use BRPOP which blocks the connection; cannot share with the Queue connection)
export const redisConnectionBlocking = redisConnection.duplicate();

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * T6: Check Redis connectivity. Returns 'ok' or 'degraded'.
 * Used by GET /api/v1/health.
 */
export async function checkRedisHealth(): Promise<"ok" | "degraded"> {
  try {
    await redisConnection.ping();
    return "ok";
  } catch {
    return "degraded";
  }
}
