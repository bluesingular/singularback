-- Migration: 0059_singular_integration_hub.sql
-- M4: Integration Hub — integrations, permissions, webhook events, tool audit log.
-- RULE 2: credentials are encrypted at rest (AES-256-GCM); LLM never receives tokens.

-- ── 1. integrations ────────────────────────────────────────────────────────────
-- One row per integration type per company.
-- Credentials are stored encrypted; vault.ts decrypts server-side for tool calls only.

CREATE TABLE IF NOT EXISTS integrations (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type                    TEXT        NOT NULL,
  name                    TEXT        NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'connected'
                            CONSTRAINT integrations_status_check
                            CHECK (status IN ('connected','disconnected','error','pending')),
  -- AES-256-GCM encrypted credentials (key derived per company via HKDF)
  credentials_enc         BYTEA       NOT NULL DEFAULT '\x'::BYTEA,
  credentials_iv          BYTEA       NOT NULL DEFAULT '\x'::BYTEA,
  credentials_tag         BYTEA       NOT NULL DEFAULT '\x'::BYTEA,
  -- OAuth token management (also encrypted at rest)
  oauth_access_token_enc  BYTEA,
  oauth_refresh_token_enc BYTEA,
  oauth_expires_at        TIMESTAMPTZ,
  -- Metadata
  scopes                  TEXT[]      NOT NULL DEFAULT '{}',
  webhook_secret          TEXT,
  config                  JSONB       NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, type)
);

CREATE INDEX IF NOT EXISTS integrations_company_idx ON integrations(company_id);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY integrations_company_isolation ON integrations
  USING (company_id = current_setting('app.company_id', true)::uuid);

-- ── 2. agent_integration_permissions ──────────────────────────────────────────
-- Controls which agents may use which integrations with which permission levels.
-- granted_by references the better-auth "user" table (TEXT pk).

CREATE TABLE IF NOT EXISTS agent_integration_permissions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  integration_id UUID        NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  permissions    TEXT[]      NOT NULL DEFAULT '{}',
  granted_by     TEXT,  -- better-auth user id (TEXT pk — no FK needed)
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, integration_id)
);

CREATE INDEX IF NOT EXISTS agent_integration_perms_agent_idx ON agent_integration_permissions(agent_id);
CREATE INDEX IF NOT EXISTS agent_integration_perms_integ_idx ON agent_integration_permissions(integration_id);

-- ── 3. webhook_events ─────────────────────────────────────────────────────────
-- Inbound webhook payloads stored before processing.
-- Acknowledged immediately (< 5s) then queued via BullMQ.

CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id     UUID        REFERENCES agents(id),
  source       TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'queued'
                 CONSTRAINT webhook_events_status_check
                 CHECK (status IN ('queued','processing','processed','failed')),
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webhook_events_company_idx ON webhook_events(company_id);
CREATE INDEX IF NOT EXISTS webhook_events_status_idx  ON webhook_events(status) WHERE status IN ('queued','processing');

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_events_company_isolation ON webhook_events
  USING (company_id = current_setting('app.company_id', true)::uuid);

-- ── 4. tool_call_log ──────────────────────────────────────────────────────────
-- Immutable audit trail for every tool invocation (AI Act requirement).
-- No UPDATE or DELETE — append-only.

CREATE TABLE IF NOT EXISTS tool_call_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID        REFERENCES agents(id),
  task_id     UUID,
  tool_type   TEXT        NOT NULL,
  tool_name   TEXT        NOT NULL,
  input       JSONB       NOT NULL,
  output      JSONB,
  status      TEXT        NOT NULL,
  duration_ms INTEGER,
  error       TEXT,
  called_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_call_log_company_idx ON tool_call_log(company_id);
CREATE INDEX IF NOT EXISTS tool_call_log_agent_idx   ON tool_call_log(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tool_call_log_called_at_idx ON tool_call_log(called_at DESC);

ALTER TABLE tool_call_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_call_log_company_isolation ON tool_call_log
  USING (company_id = current_setting('app.company_id', true)::uuid);
