-- G10: GDPR compliance — erasure log
-- Records every Article 17 erasure request for accountability.
-- audit_entries is immutable (0070) and retained under Art. 17(3)(b) legal obligation.
-- This table is the GDPR-specific record of what was erased and when.

CREATE TABLE IF NOT EXISTS "gdpr_erasure_log" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"      uuid NOT NULL,
  "subject_type"    text NOT NULL,    -- 'contact' | 'user'
  "subject_id"      uuid NOT NULL,    -- contactId or userId
  "subject_label"   text,             -- name/email at time of erasure (for human readability)
  "requested_by"    uuid NOT NULL,    -- userId who submitted the request
  "records_deleted" integer NOT NULL DEFAULT 0,
  "retained_note"   text,             -- explanation of any retained data (legal obligation)
  "erased_at"       timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "gdpr_erasure_log_company_idx" ON "gdpr_erasure_log" ("company_id");
CREATE INDEX IF NOT EXISTS "gdpr_erasure_log_subject_idx" ON "gdpr_erasure_log" ("subject_id");
