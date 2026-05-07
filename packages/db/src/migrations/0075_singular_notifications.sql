-- Gap E: notification system
-- notifications + notification_preferences tables

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"          uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id"             uuid REFERENCES "user"("id") ON DELETE CASCADE,
  "type"                text NOT NULL,
  "title"               text NOT NULL,
  "body"                text NOT NULL,
  "action_url"          text,
  "status"              text NOT NULL DEFAULT 'unread',
  "metadata"            jsonb,
  "channels_delivered"  text NOT NULL DEFAULT 'inapp',
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "expires_at"          timestamptz
);

CREATE INDEX IF NOT EXISTS "notifications_company_idx"
  ON "notifications"("company_id");

CREATE INDEX IF NOT EXISTS "notifications_user_idx"
  ON "notifications"("user_id");

CREATE INDEX IF NOT EXISTS "notifications_status_idx"
  ON "notifications"("company_id", "status");

CREATE INDEX IF NOT EXISTS "notifications_created_idx"
  ON "notifications"("company_id", "created_at");

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"          uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id"             uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "approval_inapp"      boolean NOT NULL DEFAULT true,
  "approval_email"      boolean NOT NULL DEFAULT true,
  "trust_inapp"         boolean NOT NULL DEFAULT true,
  "trust_email"         boolean NOT NULL DEFAULT true,
  "intelligence_inapp"  boolean NOT NULL DEFAULT true,
  "intelligence_email"  boolean NOT NULL DEFAULT false,
  "error_inapp"         boolean NOT NULL DEFAULT true,
  "error_email"         boolean NOT NULL DEFAULT true,
  "budget_inapp"        boolean NOT NULL DEFAULT true,
  "budget_email"        boolean NOT NULL DEFAULT true,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_unique"
  ON "notification_preferences"("company_id", "user_id");
