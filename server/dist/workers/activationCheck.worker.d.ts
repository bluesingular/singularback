/**
 * server/src/workers/activationCheck.worker.ts
 *
 * Processes "activation.check" jobs from the system queue.
 *
 * The pack installer schedules one job per activation trigger (5 total) with
 * a delay equal to the trigger's dayThreshold × 24h. When the job matures,
 * this worker evaluates whether the trigger condition is met and, if so:
 *   1. Records the trigger as fired (idempotent via ON CONFLICT DO NOTHING)
 *   2. Inserts an intelligence card visible on the operator's dashboard
 *
 * If the condition is not met (e.g., not enough tasks completed yet for the
 * day_4_milestone), the trigger is skipped — it was a time-based check, not
 * a guaranteed delivery. This is intentional: the activation sequence rewards
 * operators who engage with the platform, not idle accounts.
 *
 * RULE 6: BullMQ idempotency — jobId deduplication ensures each trigger is
 * attempted at most once per company+pack combination.
 */
import { Worker } from "bullmq";
import type { Db } from "@paperclipai/db";
export declare function createActivationCheckWorker(db: Db): Worker<{
    companyId: string;
    packSlug: string;
    triggerKey: "day_0_seed" | "day_2_first_task" | "day_4_milestone" | "day_6_relationship" | "day_7_summary";
}, any, string>;
export declare function initActivationCheckWorker(db: Db): Worker<{
    companyId: string;
    packSlug: string;
    triggerKey: "day_0_seed" | "day_2_first_task" | "day_4_milestone" | "day_6_relationship" | "day_7_summary";
}, any, string>;
//# sourceMappingURL=activationCheck.worker.d.ts.map