/**
 * server/src/workers/emailReceived.worker.ts
 *
 * Processes email.received jobs from the "agents" queue.
 * When an email arrives via webhook, this worker triggers an immediate
 * heartbeat for the target agent so it picks up the email without waiting
 * for its next scheduled interval.
 *
 * Full email fetching and task creation (via Integration Hub) will be
 * implemented in M4. For now: validate the payload and trigger wakeup.
 */
import { Worker } from "bullmq";
export declare const emailWorker: Worker<{
    companyId: string;
    agentId: string;
    from: string;
    emailId: string;
    threadId: string;
    subject: string;
    bodyPreview: string;
}, any, string>;
//# sourceMappingURL=emailReceived.worker.d.ts.map