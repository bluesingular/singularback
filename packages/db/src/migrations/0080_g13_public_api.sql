-- G13 — Public API keys and outbound webhook subscriptions

CREATE TABLE public_api_keys (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  key_hash           text        NOT NULL,
  -- read | read_write
  scope              text        NOT NULL DEFAULT 'read_write',
  rate_limit_per_hour int        NOT NULL DEFAULT 1000,
  last_used_at       timestamptz,
  revoked_at         timestamptz,
  created_by_user_id text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX public_api_keys_hash_idx    ON public_api_keys (key_hash);
CREATE INDEX        public_api_keys_company_idx ON public_api_keys (company_id);

-- Outbound webhook subscriptions: platform POSTs to customer URL on events
CREATE TABLE webhook_subscriptions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url                text        NOT NULL,
  -- JSON array of event types e.g. ["task.completed","task.approved"]
  events             jsonb       NOT NULL DEFAULT '[]',
  -- Raw HMAC-SHA256 signing secret (used server-side to sign payloads)
  signing_secret     text        NOT NULL,
  active             boolean     NOT NULL DEFAULT true,
  created_by_user_id text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webhook_subscriptions_company_idx ON webhook_subscriptions (company_id);
