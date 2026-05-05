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
import type { Db } from "@paperclipai/db";
export declare function stripeWebhookRoutes(db: Db): Router;
//# sourceMappingURL=stripe-webhook.d.ts.map