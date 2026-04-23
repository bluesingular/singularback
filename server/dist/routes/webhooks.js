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
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { integrations, webhookEvents, agents } from "@paperclipai/db";
import { emit } from "../queue/emit.js";
import pino from "pino";
const logger = pino({ name: "webhook-handler" });
function detectSource(headers) {
    if (headers["x-indeed-signature"])
        return "indeed";
    if (headers["x-calendly-webhook-signature"])
        return "calendly";
    if (headers["x-slack-signature"])
        return "slack";
    if (headers["x-hub-signature-256"])
        return "github";
    if (headers["stripe-signature"])
        return "stripe";
    return "custom";
}
// ── HMAC verification ─────────────────────────────────────────────────────────
/**
 * Verify HMAC-SHA256 webhook signature.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(req, secret, source) {
    try {
        const body = JSON.stringify(req.body);
        const computed = createHmac("sha256", secret).update(body).digest("hex");
        let received;
        switch (source) {
            case "slack":
                // Slack uses "v0=<hex>" format
                received = req.headers["x-slack-signature"]?.replace(/^v\d+=/, "");
                break;
            case "github":
                received = req.headers["x-hub-signature-256"]?.replace(/^sha256=/, "");
                break;
            case "stripe":
                // Stripe has a more complex format (t=timestamp,v1=sig) — simplified here
                received = req.headers["stripe-signature"]?.split(",")
                    .find((p) => p.startsWith("v1="))?.replace("v1=", "");
                break;
            default:
                received = req.headers["x-webhook-signature"];
        }
        if (!received)
            return false;
        const computedBuf = Buffer.from(computed, "hex");
        const receivedBuf = Buffer.from(received, "hex");
        if (computedBuf.length !== receivedBuf.length)
            return false;
        return timingSafeEqual(computedBuf, receivedBuf);
    }
    catch {
        return false;
    }
}
// ── Router factory ────────────────────────────────────────────────────────────
export function webhookRoutes(db) {
    const router = Router();
    /**
     * POST /webhooks/:companyId/:agentSlug
     *
     * Receives an inbound webhook event and queues it for processing.
     * Responds immediately with 200 to satisfy provider timeout requirements.
     */
    router.post("/:companyId/:agentSlug", async (req, res) => {
        const { companyId, agentSlug } = req.params;
        // Acknowledge immediately — processing happens asynchronously
        res.status(200).json({ received: true });
        const source = detectSource(req.headers);
        try {
            // Find the integration to get the webhook secret
            const [integration] = await db
                .select({
                id: integrations.id,
                webhookSecret: integrations.webhookSecret,
                status: integrations.status,
            })
                .from(integrations)
                .where(and(eq(integrations.companyId, companyId), eq(integrations.type, source)))
                .limit(1);
            // Signature validation (if a secret is configured)
            if (integration?.webhookSecret) {
                const valid = verifyWebhookSignature(req, integration.webhookSecret, source);
                if (!valid) {
                    logger.warn({ companyId, source, agentSlug }, "webhook: invalid HMAC signature — discarding event");
                    return;
                }
            }
            // Store the raw event
            const [event] = await db
                .insert(webhookEvents)
                .values({
                companyId,
                source,
                payload: req.body,
                status: "queued",
            })
                .returning({ id: webhookEvents.id, source: webhookEvents.source });
            // Find the target agent by slug (agents use name as slug for now)
            const [agent] = await db
                .select({ id: agents.id, companyId: agents.companyId })
                .from(agents)
                .where(and(eq(agents.companyId, companyId), eq(agents.name, agentSlug)))
                .limit(1);
            if (!agent) {
                logger.warn({ companyId, agentSlug, eventId: event?.id }, "webhook: no agent found for slug — event stored but not dispatched");
                return;
            }
            // Emit to BullMQ for async processing
            await emit.webhookReceived({
                agentId: agent.id,
                companyId,
                source: event.source,
                payload: req.body,
                receivedAt: new Date().toISOString(),
            });
            logger.info({ companyId, agentSlug, agentId: agent.id, source, eventId: event?.id }, "webhook: event queued");
        }
        catch (err) {
            // Errors here are silent to the caller (already got 200)
            logger.error({ err, companyId, agentSlug, source }, "webhook: failed to process inbound event");
        }
    });
    return router;
}
//# sourceMappingURL=webhooks.js.map