/**
 * server/src/routes/webhooks.ts
 *
 * Inbound webhook handler — G4.
 *
 * Two route patterns:
 *   POST /webhooks/:companyId/:endpointId  ← G4: endpoint-ID-based routing rules
 *   POST /webhooks/:companyId/:agentSlug   ← legacy: direct agent wakeup
 *
 * Both routes:
 * - Acknowledge immediately with 200 (providers require < 5s response)
 * - Validate HMAC signature if a secret is configured
 * - Store the raw event in webhook_events
 * - Emit a webhook.received job to BullMQ for async processing
 *
 * Source detection: inferred from request headers.
 */

import { Router, type Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { integrations, webhookEndpoints, webhookEvents, agents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { emit } from "../queue/emit.js";
import type { RoutingRule } from "../queue/jobs.js";
import pino from "pino";

const logger = pino({ name: "webhook-handler" });

// ── Source detection ──────────────────────────────────────────────────────────

type WebhookSource = "indeed" | "calendly" | "slack" | "github" | "stripe" | "custom";

function detectSource(headers: Request["headers"]): WebhookSource {
  if (headers["x-indeed-signature"]) return "indeed";
  if (headers["x-calendly-webhook-signature"]) return "calendly";
  if (headers["x-slack-signature"]) return "slack";
  if (headers["x-hub-signature-256"]) return "github";
  if (headers["stripe-signature"]) return "stripe";
  return "custom";
}

// ── HMAC verification ─────────────────────────────────────────────────────────

function verifyWebhookSignature(req: Request, secret: string, source: WebhookSource): boolean {
  try {
    const body = JSON.stringify(req.body);
    const computed = createHmac("sha256", secret).update(body).digest("hex");

    let received: string | undefined;
    switch (source) {
      case "slack":
        received = (req.headers["x-slack-signature"] as string)?.replace(/^v\d+=/, "");
        break;
      case "github":
        received = (req.headers["x-hub-signature-256"] as string)?.replace(/^sha256=/, "");
        break;
      case "stripe":
        received = (req.headers["stripe-signature"] as string)
          ?.split(",").find((p) => p.startsWith("v1="))?.replace("v1=", "");
        break;
      default:
        received = req.headers["x-webhook-signature"] as string | undefined;
    }

    if (!received) return false;
    const computedBuf = Buffer.from(computed, "hex");
    const receivedBuf = Buffer.from(received, "hex");
    if (computedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(computedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ── UUID detection ────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

// ── Router factory ────────────────────────────────────────────────────────────

export function webhookRoutes(db: Db): Router {
  const router = Router();

  /**
   * GET /webhooks/whatsapp/:companyId/verify
   *
   * Gap G — Meta webhook verification challenge.
   * Meta sends hub.mode=subscribe + hub.verify_token + hub.challenge.
   * We echo hub.challenge if the verify_token matches the one stored for this company.
   */
  router.get("/whatsapp/:companyId/verify", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    const mode      = String(req.query["hub.mode"]         ?? "");
    const token     = String(req.query["hub.verify_token"] ?? "");
    const challenge = String(req.query["hub.challenge"]    ?? "");

    // Resolve the stored verify_token for this company from integration config
    const [integration] = await db
      .select({ config: integrations.config })
      .from(integrations)
      .where(and(eq(integrations.companyId, companyId), eq(integrations.type, "whatsapp")))
      .limit(1);

    const verifyToken = (integration?.config as Record<string, unknown>)?.verifyToken as string | undefined;
    if (!verifyToken) {
      res.status(403).json({ error: "WhatsApp integration not configured" });
      return;
    }

    if (mode === "subscribe" && token === verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ error: "Webhook verification failed" });
    }
  });

  /**
   * POST /webhooks/whatsapp/:companyId
   *
   * Gap G — Inbound WhatsApp messages.
   * Parses the Meta payload and routes to the agent via the existing webhook pipeline.
   */
  router.post("/whatsapp/:companyId", async (req, res) => {
    const { companyId } = req.params as { companyId: string };

    // Verify Meta's X-Hub-Signature-256 HMAC before processing.
    // The webhookSecret is stored in the integration config at connect time.
    // If no secret is configured the message is still accepted (Meta doesn't
    // require a secret, but operators should configure one in production).
    try {
      const [waIntegration] = await db
        .select({ config: integrations.config })
        .from(integrations)
        .where(and(eq(integrations.companyId, companyId), eq(integrations.type, "whatsapp")))
        .limit(1);

      const webhookSecret = (waIntegration?.config as Record<string, unknown>)?.webhookSecret as string | undefined;
      if (webhookSecret) {
        const valid = verifyWebhookSignature(req, webhookSecret, "custom");
        if (!valid) {
          logger.warn({ companyId }, "whatsapp: invalid HMAC signature — discarding");
          res.status(200).json({ received: true }); // always 200 to Meta
          return;
        }
      }
    } catch (err) {
      logger.error({ err, companyId }, "whatsapp: HMAC check failed");
      res.status(200).json({ received: true });
      return;
    }

    // Acknowledge immediately — Meta requires < 5s
    res.status(200).json({ received: true });

    // Extract sender phone from Meta webhook payload (best-effort)
    function extractWaFrom(body: unknown): string | null {
      try {
        const b = body as Record<string, unknown>;
        const entries = b.entry as unknown[];
        const change  = ((entries?.[0] as Record<string, unknown>)?.changes as unknown[])?.[0];
        const msgs    = ((change as Record<string, unknown>)?.value as Record<string, unknown>)?.messages as unknown[];
        const from    = (msgs?.[0] as Record<string, unknown>)?.from;
        return typeof from === "string" && from ? from : null;
      } catch { return null; }
    }

    const from = extractWaFrom(req.body);
    if (!from) {
      logger.debug({ companyId }, "whatsapp: non-message event ignored");
      return;
    }

    // Emit via existing webhook pipeline
    await emit.webhookReceived({
      endpointId:   null,
      companyId,
      source:       "custom",
      payload:      { ...req.body as Record<string, unknown>, _whatsapp_from: from },
      receivedAt:   new Date().toISOString(),
      routingRules: [],
    }).catch((err) => logger.error({ err, companyId }, "whatsapp: failed to emit"));

    logger.info({ companyId, from }, "whatsapp: inbound message queued");
  });

  /**
   * POST /webhooks/:companyId/:id
   *
   * If :id looks like a UUID → G4 endpoint-ID path (routing rules).
   * Otherwise               → legacy agentSlug path (direct heartbeat).
   */
  router.post("/:companyId/:id", async (req, res) => {
    const { companyId, id } = req.params;

    // Acknowledge immediately — processing is fully async
    res.status(200).json({ received: true });

    const source = detectSource(req.headers);

    try {
      if (isUuid(id)) {
        await handleEndpointRoute(db, companyId, id, source, req);
      } else {
        await handleLegacyAgentSlugRoute(db, companyId, id, source, req);
      }
    } catch (err) {
      logger.error({ err, companyId, id, source }, "webhook: unhandled error in async handler");
    }
  });

  return router;
}

// ── G4: endpoint-ID path ──────────────────────────────────────────────────────

async function handleEndpointRoute(
  db: Db,
  companyId: string,
  endpointId: string,
  source: WebhookSource,
  req: Request,
): Promise<void> {
  // Load the webhook endpoint
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, endpointId),
        eq(webhookEndpoints.companyId, companyId),
        eq(webhookEndpoints.isActive, true),
      ),
    )
    .limit(1);

  if (!endpoint) {
    logger.warn({ companyId, endpointId }, "webhook: endpoint not found or inactive");
    return;
  }

  // HMAC validation
  if (endpoint.secret) {
    const resolvedSource = (endpoint.sourceHint as WebhookSource) ?? source;
    const valid = verifyWebhookSignature(req, endpoint.secret, resolvedSource);
    if (!valid) {
      logger.warn({ companyId, endpointId }, "webhook: invalid HMAC signature — discarding");
      return;
    }
  }

  // Store event
  await db.insert(webhookEvents).values({
    companyId,
    source: endpoint.sourceHint ?? source,
    payload: req.body as Record<string, unknown>,
    status: "queued",
  });

  // Emit to BullMQ with routing rules from the endpoint
  await emit.webhookReceived({
    endpointId,
    companyId,
    source: endpoint.sourceHint ?? source,
    payload: req.body as Record<string, unknown>,
    receivedAt: new Date().toISOString(),
    routingRules: (endpoint.routingRules ?? []) as RoutingRule[],
  });

  logger.info({ companyId, endpointId, source }, "webhook: endpoint event queued");
}

// ── Legacy: agentSlug path ────────────────────────────────────────────────────

async function handleLegacyAgentSlugRoute(
  db: Db,
  companyId: string,
  agentSlug: string,
  source: WebhookSource,
  req: Request,
): Promise<void> {
  // Signature validation via integration secret
  const [integration] = await db
    .select({ webhookSecret: integrations.webhookSecret })
    .from(integrations)
    .where(and(eq(integrations.companyId, companyId), eq(integrations.type, source)))
    .limit(1);

  if (integration?.webhookSecret) {
    const valid = verifyWebhookSignature(req, integration.webhookSecret, source);
    if (!valid) {
      logger.warn({ companyId, source, agentSlug }, "webhook: invalid HMAC — discarding");
      return;
    }
  }

  // Store event
  await db.insert(webhookEvents).values({
    companyId,
    source,
    payload: req.body as Record<string, unknown>,
    status: "queued",
  });

  // Find the target agent by name
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.companyId, companyId), eq(agents.name, agentSlug)))
    .limit(1);

  if (!agent) {
    logger.warn({ companyId, agentSlug }, "webhook: no agent found — event stored, not dispatched");
    return;
  }

  // Emit direct heartbeat via routing rule
  await emit.webhookReceived({
    endpointId: null,
    companyId,
    source,
    payload: req.body as Record<string, unknown>,
    receivedAt: new Date().toISOString(),
    routingRules: [{ action: { type: "heartbeat", agentId: agent.id } }],
  });

  logger.info({ companyId, agentSlug, agentId: agent.id, source }, "webhook: legacy event queued");
}
