-- G15 — Third-party action type registration
--
-- Webhook-based alternative to full npm plugin installation.
-- Third-party developers register an action type with a JSON Schema
-- and a webhook URL. When an agent invokes the action type, the platform
-- POSTs to the webhook URL, HMAC-signs the payload, and returns the response.

CREATE TABLE registered_action_types (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global (instance-admin only); non-null = per-company
  company_id         uuid        REFERENCES companies(id) ON DELETE CASCADE,
  slug               text        NOT NULL,
  name               text        NOT NULL,
  description        text,
  -- JSON Schema describing the input payload the webhook expects
  input_schema       jsonb       NOT NULL DEFAULT '{}',
  -- JSON Schema describing the output payload the webhook returns
  output_schema      jsonb       NOT NULL DEFAULT '{}',
  -- Platform POSTs to this URL to invoke the action type
  webhook_url        text        NOT NULL,
  -- Raw HMAC-SHA256 signing secret — used to sign X-Swwarm-Signature header
  webhook_secret     text        NOT NULL,
  is_active          boolean     NOT NULL DEFAULT true,
  created_by_user_id text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Slug must be unique within a company (or globally when company_id IS NULL)
CREATE UNIQUE INDEX registered_action_types_company_slug_idx
  ON registered_action_types (COALESCE(company_id::text, 'global'), slug);

CREATE INDEX registered_action_types_company_idx
  ON registered_action_types (company_id);
