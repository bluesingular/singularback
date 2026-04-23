/**
 * server/src/queue/queues.ts
 *
 * BullMQ Queue instances. Import these only from emit.ts and monitoring.ts.
 * All other code should use emit.* to enqueue jobs.
 */

import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

const defaultOpts = { connection: redisConnection };

// Agent execution queue — highest priority, most time-sensitive
export const agentQueue = new Queue("agents", {
  ...defaultOpts,
  defaultJobOptions: {
    removeOnComplete: { age: 86400, count: 1000 }, // keep 24h or last 1000
    removeOnFail: { age: 604800 }, // keep failed jobs 7 days for inspection
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

// Background processing — memory extraction, skill improvement
export const backgroundQueue = new Queue("background", {
  ...defaultOpts,
  defaultJobOptions: {
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 604800 },
    attempts: 5,
    backoff: { type: "exponential", delay: 10000 },
  },
});

// System jobs — billing resets, maintenance tasks
export const systemQueue = new Queue("system", {
  ...defaultOpts,
  defaultJobOptions: {
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
    attempts: 3,
  },
});
