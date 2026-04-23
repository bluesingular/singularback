/**
 * server/src/queue/queues.ts
 *
 * BullMQ Queue instances. Import these only from emit.ts and monitoring.ts.
 * All other code should use emit.* to enqueue jobs.
 */
import { Queue } from "bullmq";
export declare const agentQueue: Queue<any, any, string, any, any, string>;
export declare const backgroundQueue: Queue<any, any, string, any, any, string>;
export declare const systemQueue: Queue<any, any, string, any, any, string>;
//# sourceMappingURL=queues.d.ts.map