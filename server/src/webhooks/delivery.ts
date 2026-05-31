/**
 * server/src/webhooks/delivery.ts
 *
 * G13 — Outbound webhook delivery.
 *
 * When a subscribed event fires (task.completed, task.blocked, task.created,
 * mission.completed), this service delivers the payload to all matching
 * webhook subscriptions for the company.
 *
 * Security: every delivery is HMAC-SHA256 signed.
 * Header: X-Swwarm-Signature: sha256=<hex>
 * Header: X-Swwarm-Event: <event_type>
 * Header: X-Swwarm-Delivery: <uuid>
 * Header: X-Swwarm-Timestamp: <unix_seconds>
 *
 * Retry policy: 3 attempts with exponential backoff (1s, 5s, 25s).
 * Non-2xx response or timeout = failure. Failure is logged, not thrown.
 *
 * Rate: maximum 100 deliveries/minute per company (BullMQ concurrency).
 * Timeout: 10 seconds per delivery attempt.
 */

import { createHmac, randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { webhookSubscriptions } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "webhook-delivery" });

const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_RETRIES         = 3;
const RETRY_DELAYS        = [1_000, 5_000, 25_000]; // ms

// ── Types ─────────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "task.created"
  | "task.completed"
  | "task.blocked"
  | "task.failed"
  | "task.cancelled"
  | "mission.created"
  | "mission.completed"
  | "mission.archived"
  | "agent.status_changed";

export interface WebhookPayload {
  event:      WebhookEventType;
  companyId:  string;
  data:       Record<string, unknown>;
  timestamp:  number;  // unix seconds
}

export interface DeliveryResult {
  subscriptionId: string;
  url:            string;
  deliveryId:     string;
  statusCode:     number | null;
  success:        boolean;
  attempts:       number;
}

// ── deliverEvent ──────────────────────────────────────────────────────────────

/**
 * Deliver an event to all active subscriptions matching the event type.
 * Called by workers when events occur.
 *
 * Fires all matching subscriptions in parallel.
 * Individual delivery failures are logged but never bubble up.
 */
export async function deliverEvent(
  db:      Db,
  payload: WebhookPayload,
): Promise<DeliveryResult[]> {
  // Find active subscriptions that include this event type
  const subscriptions = await (db as any)
    .select()
    .from(webhookSubscriptions)
    .where(and(
      eq(webhookSubscriptions.companyId, payload.companyId),
      eq(webhookSubscriptions.active, true),
    ));

  const matching = subscriptions.filter((sub: any) => {
    const events: string[] = Array.isArray(sub.events) ? sub.events : [];
    return events.length === 0 || events.includes(payload.event) || events.includes("*");
  });

  if (matching.length === 0) return [];

  const results = await Promise.all(
    matching.map((sub: any) => deliverToSubscription(sub, payload)),
  );

  return results;
}

// ── deliverToSubscription ─────────────────────────────────────────────────────

async function deliverToSubscription(
  sub:     { id: string; url: string; signingSecret: string },
  payload: WebhookPayload,
): Promise<DeliveryResult> {
  const deliveryId = randomUUID();
  const body       = JSON.stringify(payload);
  const signature  = sign(body, sub.signingSecret);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const res = await fetch(sub.url, {
        method:  "POST",
        headers: {
          "Content-Type":         "application/json",
          "X-Swwarm-Signature":   `sha256=${signature}`,
          "X-Swwarm-Event":       payload.event,
          "X-Swwarm-Delivery":    deliveryId,
          "X-Swwarm-Timestamp":   String(payload.timestamp),
          "User-Agent":           "Swwarm-Webhooks/1.0",
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        logger.info(
          { subscriptionId: sub.id, event: payload.event, statusCode: res.status, attempt },
          "webhook: delivered",
        );
        return { subscriptionId: sub.id, url: sub.url, deliveryId, statusCode: res.status, success: true, attempts: attempt };
      }

      logger.warn(
        { subscriptionId: sub.id, event: payload.event, statusCode: res.status, attempt },
        "webhook: non-2xx response",
      );
    } catch (err) {
      logger.warn(
        { subscriptionId: sub.id, event: payload.event, attempt, err },
        "webhook: delivery failed",
      );
    }

    // Wait before retry (except on last attempt)
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1] ?? 1000));
    }
  }

  return { subscriptionId: sub.id, url: sub.url, deliveryId, statusCode: null, success: false, attempts: MAX_RETRIES };
}

// ── sign ──────────────────────────────────────────────────────────────────────

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// ── verifyWebhookSignature ────────────────────────────────────────────────────

/**
 * Verify an inbound webhook signature from a subscriber's perspective.
 * Use this in SDK samples and documentation to show receivers how to verify.
 */
export function verifyWebhookSignature(
  rawBody:   string,
  signature: string,
  secret:    string,
): boolean {
  const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const expected = sign(rawBody, secret);
  if (received.length !== expected.length) return false;
  // Timing-safe comparison
  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
