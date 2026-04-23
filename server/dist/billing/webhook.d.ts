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
import type { Db } from "@paperclipai/db";
export interface StripeEventPayload {
    id: string;
    type: string;
    data: {
        object: {
            id?: string;
            customer?: string;
            status?: string;
            items?: {
                data: Array<{
                    price?: {
                        lookup_key?: string;
                    };
                }>;
            };
            metadata?: Record<string, string>;
        };
    };
}
export interface WebhookResult {
    /** true = event was processed; false = duplicate, skipped */
    processed: boolean;
    stripeEventId: string;
    eventType: string;
}
/**
 * Process an incoming Stripe webhook event.
 *
 * @param db     Drizzle database instance
 * @param event  Parsed Stripe event payload (signature verification done upstream)
 */
export declare function handleStripeWebhook(db: Db, event: StripeEventPayload): Promise<WebhookResult>;
//# sourceMappingURL=webhook.d.ts.map