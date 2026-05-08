-- G5: Human clarification flow
-- Per-company timeout setting + clarification request lifecycle table.

ALTER TABLE "companies"
  ADD COLUMN "clarification_timeout_hours" integer NOT NULL DEFAULT 48;

CREATE TABLE IF NOT EXISTS "clarification_requests" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"      uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "issue_id"        uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "agent_id"        uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "question"        text NOT NULL,
  "status"          text NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'answered' | 'timed_out' | 'cancelled'
  "answer"          text,
  "answered_by"     text,
  "timeout_job_id"  text,
  "asked_at"        timestamptz NOT NULL DEFAULT now(),
  "answered_at"     timestamptz,
  "timed_out_at"    timestamptz
);

CREATE INDEX IF NOT EXISTS "clarification_requests_company_idx"
  ON "clarification_requests" ("company_id");

CREATE INDEX IF NOT EXISTS "clarification_requests_issue_idx"
  ON "clarification_requests" ("issue_id");

CREATE INDEX IF NOT EXISTS "clarification_requests_pending_idx"
  ON "clarification_requests" ("company_id", "status")
  WHERE status = 'pending';
