-- At 100 customers: AG-12, AG-13, AG-14, Gap M

-- ── AG-14: Counterfactual explanations ───────────────────────────────────────
-- Stored per task after judge evaluation for high-risk skills.
-- external_safe lines: safe for affected persons (AI Act Article 13).
-- internal_full lines: operators only, may be comparative.

CREATE TABLE IF NOT EXISTS counterfactual_explanations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  decision       TEXT        NOT NULL,
  key_factors    JSONB       NOT NULL DEFAULT '[]',
  counterfactuals TEXT[]     NOT NULL DEFAULT '{}',
  external_safe  TEXT[]      NOT NULL DEFAULT '{}',
  internal_full  TEXT[]      NOT NULL DEFAULT '{}',
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS counterfactual_task_idx ON counterfactual_explanations (task_id);
CREATE INDEX IF NOT EXISTS counterfactual_company_idx ON counterfactual_explanations (company_id, generated_at DESC);

-- ── AG-12: Federated query log ────────────────────────────────────────────────
-- Audit trail for live integration queries — required for GDPR data access logs.

CREATE TABLE IF NOT EXISTS integration_query_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id          UUID        REFERENCES issues(id) ON DELETE SET NULL,
  agent_id         UUID        REFERENCES agents(id) ON DELETE SET NULL,
  integration_slug VARCHAR(60) NOT NULL,
  query_template   VARCHAR(100) NOT NULL,
  gdpr_required    BOOLEAN     NOT NULL DEFAULT false,
  cached           BOOLEAN     NOT NULL DEFAULT false,
  result_tokens    INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS integration_query_company_idx ON integration_query_log (company_id, created_at DESC);

-- ── Gap M: Contact preferred timing ─────────────────────────────────────────
-- Learned from response patterns — 3+ observations required before use.
-- Format: {"day_of_week": [1,2], "hour_range": [8,10], "confidence": 0.8, "observations": 5}

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS preferred_contact_time JSONB;

-- ── AG-13: Uncertainty block tracking ────────────────────────────────────────
-- Track which agents have the [[UNCERTAINTY]] block installed in their soul.md.
-- Allows the approval card to know whether to render confidence annotations.

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS uncertainty_block_installed BOOLEAN NOT NULL DEFAULT false;
