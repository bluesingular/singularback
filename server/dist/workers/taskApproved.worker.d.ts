/**
 * server/src/workers/taskApproved.worker.ts
 *
 * Processes task.approved jobs from the "agents" queue.
 * When an operator approves a pending action, the agent must execute it
 * immediately — not wait for the next heartbeat interval.
 *
 * RULE 7 (APPROVAL FLOW NON-NEGOTIABLE): requires_approval action →
 * approval_requests record → wait for human. This worker fires the moment
 * the human approves, ensuring zero additional delay.
 */
import { Worker } from "bullmq";
export declare const taskApprovedWorker: Worker<{
    companyId: string;
    agentId: string;
    taskId: string;
    approvedBy: string;
}, any, string>;
//# sourceMappingURL=taskApproved.worker.d.ts.map