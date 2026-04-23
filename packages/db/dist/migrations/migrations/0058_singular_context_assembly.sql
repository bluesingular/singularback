-- Migration: 0058_singular_context_assembly.sql
-- M2: Context assembly pipeline — company_dna and memory_entries tables.
-- memory_entries.embedding vector column added in M8 when pgvector is enabled.
-- Never edit existing migrations.

-- ── 1. company_dna ─────────────────────────────────────────────────────────────
-- One row per company. Supplies Layer 2 (Company DNA) in assembleContext().
-- updated_by references the better-auth "user" table which has a TEXT pk.

CREATE TABLE IF NOT EXISTS company_dna (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID        NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  description        TEXT        NOT NULL DEFAULT '',
  customer_profile   TEXT        NOT NULL DEFAULT '',
  tone               TEXT        NOT NULL DEFAULT 'professional',
  brand_rules        TEXT        NOT NULL DEFAULT '',
  regulatory_context TEXT        NOT NULL DEFAULT '',
  forbidden_topics   TEXT[]      NOT NULL DEFAULT '{}',
  terminology        JSONB       NOT NULL DEFAULT '{}',
  competitors        TEXT[]      NOT NULL DEFAULT '{}',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         TEXT  -- better-auth user id (TEXT pk — no FK needed)
);

ALTER TABLE company_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_dna_company_isolation ON company_dna
  USING (company_id = current_setting('app.company_id', true)::uuid);

-- ── 2. memory_entries (stub) ───────────────────────────────────────────────────
-- Foundation table for M8 org memory. Stub allows assembler.ts to query it
-- safely before the pgvector embedding column is added in M8.

CREATE TABLE IF NOT EXISTS memory_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID        REFERENCES agents(id),
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  importance  INTEGER     NOT NULL DEFAULT 3
                CONSTRAINT memory_entries_importance_check CHECK (importance BETWEEN 1 AND 5),
  archived    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: embedding vector(1024) column added in M8 migration when pgvector is enabled.

CREATE INDEX IF NOT EXISTS memory_entries_company_idx ON memory_entries(company_id);
CREATE INDEX IF NOT EXISTS memory_entries_agent_idx   ON memory_entries(agent_id) WHERE agent_id IS NOT NULL;

ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_entries_company_isolation ON memory_entries
  USING (company_id = current_setting('app.company_id', true)::uuid);
