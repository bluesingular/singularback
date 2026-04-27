/**
 * server/src/workers/index.ts
 *
 * Worker registry — importing this module starts all BullMQ workers.
 * Import order does not matter; BullMQ routes jobs by queue name + job name.
 */

export { emailWorker } from "./emailReceived.worker.js";
export { taskApprovedWorker } from "./taskApproved.worker.js";
export { initActivationCheckWorker } from "./activationCheck.worker.js";
