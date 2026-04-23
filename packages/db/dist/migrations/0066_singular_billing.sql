-- M14: Stripe billing — idempotency log for webhook events
-- stripe_events: exactly-once processing via UNIQUE constraint on stripe_event_id

CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stripe_event_id" TEXT NOT NULL,
  "event_type"      TEXT NOT NULL,
  "processed_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "stripe_events_event_id_unique"
  ON "stripe_events" ("stripe_event_id");
