-- G4: Inbound webhook endpoints
-- Each row represents a named endpoint a company exposes to external systems.
-- POST /webhooks/{company_id}/{endpoint_id} → routing rules → BullMQ

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"    uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name"          text NOT NULL,
  "secret"        text,
  "source_hint"   text NOT NULL DEFAULT 'custom',
  "routing_rules" jsonb NOT NULL DEFAULT '[]',
  "is_active"     boolean NOT NULL DEFAULT true,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "webhook_endpoints_company_idx"
  ON "webhook_endpoints" ("company_id");
