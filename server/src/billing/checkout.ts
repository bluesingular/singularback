/**
 * Gap A — Stripe checkout session creation.
 *
 * Creates a hosted Stripe Checkout session for the selected plan.
 * If STRIPE_SECRET_KEY is not configured, returns { url: null } so the
 * client can skip checkout and go straight to the console (beta / free tier).
 *
 * Env vars required:
 *   STRIPE_SECRET_KEY         — Stripe API key
 *   STRIPE_GROWTH_PRICE_ID    — Stripe price ID for "growth" plan
 *   STRIPE_PRO_PRICE_ID       — Stripe price ID for "pro" plan
 *   APP_URL                   — Base URL for success/cancel redirects
 */

import pino from "pino";

const log = pino({ name: "billing:checkout" });

const PRICE_IDS: Record<string, string | undefined> = {
  growth: process.env.STRIPE_GROWTH_PRICE_ID,
  pro:    process.env.STRIPE_PRO_PRICE_ID,
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Dynamic import to avoid hard dep at module load time
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
}

export async function createCheckoutSession(opts: {
  companyId: string;
  userId: string;
  email: string;
  plan?: string;
  appUrl?: string;
}): Promise<{ url: string | null; sessionId: string | null }> {
  const stripe = getStripe();
  if (!stripe) {
    log.warn({ companyId: opts.companyId }, "Stripe not configured — skipping checkout");
    return { url: null, sessionId: null };
  }

  const plan = opts.plan ?? "growth";
  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    log.warn({ plan }, "No price ID configured for plan — skipping checkout");
    return { url: null, sessionId: null };
  }

  const appUrl = opts.appUrl ?? process.env.APP_URL ?? "http://localhost:5173";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: opts.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { companyId: opts.companyId, userId: opts.userId },
      success_url: `${appUrl}/succes-paiement?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/catalogue`,
      allow_promotion_codes: true,
    });

    return { url: session.url, sessionId: session.id };
  } catch (err) {
    log.error({ err, companyId: opts.companyId }, "Stripe checkout session creation failed");
    return { url: null, sessionId: null };
  }
}

export async function createBillingPortalSession(opts: {
  stripeCustomerId: string;
  appUrl?: string;
}): Promise<{ url: string | null }> {
  const stripe = getStripe();
  if (!stripe || !opts.stripeCustomerId) return { url: null };

  const appUrl = opts.appUrl ?? process.env.APP_URL ?? "http://localhost:5173";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: opts.stripeCustomerId,
      return_url: `${appUrl}/parametres`,
    });
    return { url: session.url };
  } catch (err) {
    log.error({ err }, "Stripe billing portal session creation failed");
    return { url: null };
  }
}
