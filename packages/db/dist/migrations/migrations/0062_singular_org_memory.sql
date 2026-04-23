-- M8: Org memory (pgvector optional) + Contact entity foundation
-- ────────────────────────────────────────────────────────────────────────────
-- pgvector is optional: if not installed (e.g. embedded-postgres dev environment),
-- the extension and embedding column are silently skipped.
-- Semantic search will be unavailable without pgvector; the rest of the app works fine.

-- 1. Enable pgvector (skip gracefully if not installed)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available — embedding column will be skipped';
END $$;

-- 2. Add 1024-dim embedding column (only if pgvector loaded successfully)
DO $$ BEGIN
  ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS embedding vector(1024);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping embedding column — pgvector not available';
END $$;

-- 3. ivfflat index (only if pgvector loaded successfully)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS memory_entries_embedding_idx
    ON memory_entries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping embedding index — pgvector not available';
END $$;

-- 4. contacts — the person (candidate, client, partner, etc.)
CREATE TABLE IF NOT EXISTS contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name      text NOT NULL,
  email          text,
  phone          text,
  organisation   text,
  role           text,
  notes          text,
  tags           text[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_company_idx ON contacts (company_id);
CREATE INDEX IF NOT EXISTS contacts_name_idx    ON contacts (full_name);

-- 5. contact_events — timeline of interactions
CREATE TABLE IF NOT EXISTS contact_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  summary      text NOT NULL,
  agent_id     uuid REFERENCES agents(id),
  task_id      uuid,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_events_contact_idx     ON contact_events (contact_id);
CREATE INDEX IF NOT EXISTS contact_events_company_idx     ON contact_events (company_id);
CREATE INDEX IF NOT EXISTS contact_events_occurred_at_idx ON contact_events (occurred_at DESC);

-- 6. contact_notes — agent-written notes
CREATE TABLE IF NOT EXISTS contact_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  content     text NOT NULL,
  agent_id    uuid REFERENCES agents(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_notes_contact_idx ON contact_notes (contact_id);
CREATE INDEX IF NOT EXISTS contact_notes_company_idx ON contact_notes (company_id);
