/**
 * server/src/routes/stripe-webhook.ts
 *
 * HTTP adapter for the Stripe billing webhook — M14.
 * Mounted at POST /billing/stripe (outside /api, no JWT required).
 *
 * Security: Stripe signs every event with HMAC-SHA256.
 * We verify the signature before processing; unverified requests are rejected 400.
 * The STRIPE_WEBHOOK_SECRET env var must be set in production.
 */

import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { handleStripeWebhook, type StripeEventPayload } from "../billing/webhook.js";
import pino from "pino";

const logger = pino({ name: "stripe-webhook-route" });

function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  try {
    // Stripe signature format: "t=<timestamp>,v1=<hex_sig>[,v1=...]"
    const parts = Object.fromEntries(
      signature.split(",").map((p) => p.split("=")),
    ) as Record<string, string>;
    const { t: timestamp, v1: received } = parts;
    if (!timestamp || !received) return false;

    const payload = `${timestamp}.${rawBody}`;
    const computed = createHmac("sha256", secret).update(payload).digest("hex");

    const computedBuf = Buffer.from(computed, "hex");
    const receivedBuf = Buffer.from(received, "hex");
    if (computedBuf.length !== receivedBuf.length) return false;

    return timingSafeEqual(computedBuf, receivedBuf);
  } catch {
    return false;
  }
}

export function stripeWebhookRoutes(db: Db): Router {
  const router = Router();

  // Use raw body for signature verification — must come before express.json()
  router.post(
    "/",
    (req, res, next) => {
      // Collect raw body buffer for HMAC verification
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        (req as any).rawBody = Buffer.concat(chunks).toString("utf-8");
        // Also parse JSON so downstream code can use req.body
        try {
          req.body = JSON.parse((req as any).rawBody);
        } catch {
          res.status(400).json({ error: "Invalid JSON body" });
          return;
        }
        next();
      });
    },
    async (req, res) => {
      const signature = req.headers["stripe-signature"] as string | undefined;
      const secret = process.env.STRIPE_WEBHOOK_SECRET;

      if (secret) {
        if (!signature) {
          res.status(400).json({ error: "Missing stripe-signature header" });
          return;
        }
        const rawBody = (req as any).rawBody as string;
        if (!verifyStripeSignature(rawBody, signature, secret)) {
          logger.warn("stripe-webhook-route: invalid signature — rejected");
          res.status(400).json({ error: "Invalid signature" });
          return;
        }
      } else {
        logger.warn("stripe-webhook-route: STRIPE_WEBHOOK_SECRET not set — skipping verification (dev only)");
      }

      try {
        const result = await handleStripeWebhook(db, req.body as StripeEventPayload);
        res.json({ received: true, processed: result.processed });
      } catch (err) {
        logger.error({ err }, "stripe-webhook-route: handler error");
        res.status(500).json({ error: "Webhook processing failed" });
      }
    },
  );

  return router;
}
