-- 0103 — Planning mode, routine revisions, document annotations
-- Idempotent additive migrations only. No data is modified.

-- ── 3. Planning mode on issues ────────────────────────────────────────────────
-- work_mode: 'standard' (default) | 'planning' (structured plan creation)
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS work_mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (work_mode IN ('standard', 'planning'));

-- ── 4. Routine revision history ───────────────────────────────────────────────
-- Append-only log of every change to a routine definition.
CREATE TABLE IF NOT EXISTS routine_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id      UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  variables       JSONB NOT NULL DEFAULT '[]',
  changed_by_user_id  TEXT,
  changed_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  change_summary  TEXT,        -- plain-language diff summary
  snapshot        JSONB NOT NULL DEFAULT '{}', -- full routine state at this revision
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (routine_id, revision_number)
);
CREATE INDEX IF NOT EXISTS routine_revisions_routine_idx
  ON routine_revisions (routine_id, revision_number DESC);

-- ── 1. Document annotations ───────────────────────────────────────────────────
-- Revision-aware inline comment threads on document passages.
CREATE TABLE IF NOT EXISTS document_annotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- The revision this annotation was created against (for stable anchoring)
  revision_id      UUID REFERENCES document_revisions(id) ON DELETE SET NULL,
  -- Text anchor: start/end character offsets in the document body
  anchor_start     INTEGER NOT NULL,
  anchor_end       INTEGER NOT NULL,
  -- The selected text at creation time (snapshot — survives document edits)
  selected_text    TEXT NOT NULL,
  -- Threaded: replies reference a parent annotation
  parent_id        UUID REFERENCES document_annotations(id) ON DELETE CASCADE,
  -- Body of this annotation
  body             TEXT NOT NULL,
  resolved         BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id  TEXT,
  created_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS document_annotations_document_idx
  ON document_annotations (document_id, created_at);
CREATE INDEX IF NOT EXISTS document_annotations_parent_idx
  ON document_annotations (parent_id);

-- ── 5. Sidebar hide/collapse preferences (extends existing table) ─────────────
ALTER TABLE company_user_sidebar_preferences
  ADD COLUMN IF NOT EXISTS hidden_agent_ids  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hidden_project_ids JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS collapsed_sections JSONB NOT NULL DEFAULT '[]';
