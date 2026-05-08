-- G12 — MCP Server API keys
-- Per-company bearer tokens for external AI systems (Claude, GPT, Dust, etc.)
-- to authenticate against the MCP endpoint.

CREATE TABLE mcp_api_keys (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  -- SHA-256 hex of the raw key (raw key shown once at creation, never stored)
  key_hash     text        NOT NULL,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mcp_api_keys_hash_idx    ON mcp_api_keys (key_hash);
CREATE INDEX        mcp_api_keys_company_idx ON mcp_api_keys (company_id);
