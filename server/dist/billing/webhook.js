/**
 * server/src/billing/webhook.ts
 *
 * Stripe webhook handler — M14.
 *
 * Guarantees:
 *   - Idempotent: if stripeEventId already in stripe_events, the event is
 *     silently skipped. Stripe retries webhooks on failure; this makes those
 *     retries safe.
 *   - Atomic plan change: stripeEvents insert + company update happen in a
 *     single DB transaction so no partial state is possible.
 *   - Unknown event types are acknowledged (200 OK) and recorded but produce
 *     no side effects (defensive: Stripe adds new event types over time).
 *
 * Supported events:
 *   customer.subscription.updated  → update plan + limits
 *   customer.subscription.deleted  → downgrade to "solo"
 */
import { eq } from "drizzle-orm";
import { stripeEvents, companies } from "@paperclipai/db";
import { applyPlanLimits, UnknownPlanError } from "./plans.js";
import pino from "pino";
const logger = pino({ name: "stripe-webhook" });
// ── handleStripeWebhook ───────────────────────────────────────────────────────
/**
 * Process an incoming Stripe webhook event.
 *
 * @param db     Drizzle database instance
 * @param event  Parsed Stripe event payload (signature verification done upstream)
 */
export async function handleStripeWebhook(db, event) {
    const { id: stripeEventId, type: eventType } = event;
    // ── Idempotency check ─────────────────────────────────────────────────────
    // Check if already processed; if so, skip entirely.
    const existing = await db
        .select({ id: stripeEvents.id })
        .from(stripeEvents)
        .where(eq(stripeEvents.stripeEventId, stripeEventId));
    if (existing.length > 0) {
        logger.info({ stripeEventId, eventType }, "stripe-webhook: duplicate — skipped");
        return { processed: false, stripeEventId, eventType };
    }
    // ── Process event in transaction ──────────────────────────────────────────
    await db.transaction(async (tx) => {
        // 1. Record event (idempotency log)
        await tx.insert(stripeEvents).values({ stripeEventId, eventType });
        // 2. Handle supported event types
        if (eventType === "customer.subscription.updated" ||
            eventType === "customer.subscription.deleted") {
            const sub = event.data.object;
            const stripeSubId = sub.id;
            const stripeCustomerId = sub.customer;
            if (!stripeSubId && !stripeCustomerId) {
                logger.warn({ stripeEventId, eventType }, "stripe-webhook: no subscription or customer id");
                return;
            }
            // Determine new plan
            let planSlug;
            if (eventType === "customer.subscription.deleted") {
                planSlug = "solo"; // downgrade on cancellation
            }
            else {
                // Read plan from price lookup_key or metadata
                const lookupKey = sub.items?.data?.[0]?.price?.lookup_key ?? "";
                planSlug = parsePlanFromLookupKey(lookupKey)
                    ?? sub.metadata?.plan
                    ?? "solo";
            }
            let limits;
            try {
                limits = applyPlanLimits(planSlug);
            }
            catch (err) {
                if (err instanceof UnknownPlanError) {
                    logger.warn({ stripeEventId, planSlug }, "stripe-webhook: unknown plan, defaulting to solo");
                    limits = applyPlanLimits("solo");
                }
                else {
                    throw err;
                }
            }
            // Update company by stripeSubId or stripeCustomerId
            const whereClause = stripeSubId
                ? eq(companies.stripeSubId, stripeSubId)
                : eq(companies.stripeCustomerId, stripeCustomerId);
            await tx
                .update(companies)
                .set({
                plan: limits.plan,
                tasksLimitMonth: limits.tasksLimitMonth,
                tokensLimitMonth: limits.tokensLimitMonth,
                updatedAt: new Date(),
            })
                .where(whereClause);
            logger.info({ stripeEventId, eventType, planSlug, stripeSubId }, "stripe-webhook: company plan updated");
        }
        else {
            // Unrecognised event type — recorded but no side effects
            logger.info({ stripeEventId, eventType }, "stripe-webhook: unhandled event type — recorded");
        }
    });
    return { processed: true, stripeEventId, eventType };
}
// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Derive plan slug from a Stripe price lookup_key.
 * Expected convention: "singular_<plan>_monthly" or "singular_<plan>_yearly"
 */
function parsePlanFromLookupKey(lookupKey) {
    const match = lookupKey.match(/^singular_(\w+)_(?:monthly|yearly)$/);
    return match ? match[1] : null;
}
//# sourceMappingURL=webhook.js.map