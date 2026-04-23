/**
 * server/src/queue/redis.ts
 *
 * Shared Redis connections for BullMQ.
 * Two connections are required: one for Queue operations (enqueue/inspect),
 * and one for Worker blocking operations (BRPOP/BLPOP streams).
 */
import { Redis } from "ioredis";
export declare const redisConnection: Redis;
export declare const redisConnectionBlocking: Redis;
//# sourceMappingURL=redis.d.ts.map