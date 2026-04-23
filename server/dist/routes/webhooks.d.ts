/**
 * server/src/routes/webhooks.ts
 *
 * Inbound webhook handler — receives events from external systems
 * (Indeed, Calendly, Slack, custom integrations) and queues them for processing.
 *
 * Route: POST /webhooks/:companyId/:agentSlug
 *
 * Design:
 * - Acknowledge immediately with 200 (most providers require < 5s response)
 * - HMAC signature validation happens after acknowledgement (async)
 * - Invalid signatures: logged as warning, not stored
 * - Valid events: stored in webhook_events + queued via BullMQ emit.webhookReceived
 *
 * Source detection: infers the sender from request headers
 * (X-Indeed-Signature, X-Calendly-Webhook-Signature, X-Slack-Signature, etc.)
 */
import { Router } from "express";
import type { Db } from "@paperclipai/db";
export declare function webhookRoutes(db: Db): Router;
//# sourceMappingURL=webhooks.d.ts.map