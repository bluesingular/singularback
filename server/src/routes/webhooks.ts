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
