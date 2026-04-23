/**
 * server/src/queue/scheduler.ts
 *
 * Scheduler bootstrap — called once on server start.
 * Seeds BullMQ heartbeat jobs for all active agents and schedules monthly
 * cost resets for all active companies.
 *
 * This replaces Paperclip's setInterval(tickTimers) polling loop. Instead
 * of checking all agents every N seconds, each agent has its own BullMQ
 * job that reschedules itself after execution (see heartbeat.worker.ts).
 */
import type { Db } from "@paperclipai/db";
export declare function bootstrapScheduler(db: Db): Promise<void>;
/**
 * Gracefully close all queue connections on shutdown.
 * Call this in the process exit handler.
 */
export declare function shutdownScheduler(): Promise<void>;
//# sourceMappingURL=scheduler.d.ts.map