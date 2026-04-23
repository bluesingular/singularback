/**
 * packages/db/src/schema/billing.ts
 *
 * Stripe billing — M14.
 *
 * stripe_events — idempotency log for incoming Stripe webhooks.
 *   stripeEventId is UNIQUE — duplicate webhook delivery is a no-op.
 *   Stripe guarantees at-least-once delivery; this table provides exactly-once.
 */

import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const stripeEvents = pgTable(
  "stripe_events",
  {
    id:            uuid("id").primaryKey().defaultRandom(),

    // Stripe event ID, e.g. "evt_1Pq3ZNRwK8BqU2Rg4BcXkY9a"
    stripeEventId: text("stripe_event_id").notNull(),

    // Stripe event type, e.g. "customer.subscription.updated"
    eventType:     text("event_type").notNull(),

    processedAt:   timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    stripeEventIdUnique: uniqueIndex("stripe_events_event_id_unique").on(t.stripeEventId),
  }),
);
