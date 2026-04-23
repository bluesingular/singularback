-- M10: Skill versioning + self-improvement + evaluation framework
-- skill_versions + golden_datasets
-- ────────────────────────────────────────────────────────────────────────────
-- Drizzle migration — do not edit once applied.

CREATE TABLE IF NOT EXISTS skill_versions (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  skill_type           text         NOT NULL,
  version              text         NOT NULL,
  prompt_body          text         NOT NULL,
  frontmatter          jsonb        NOT NULL,
  status               text         NOT NULL DEFAULT 'draft',
  benchmark_score      numeric(4,2),
  benchmark_item_count integer,
  parent_version_id    uuid,
  created_by_agent_id  uuid         REFERENCES agents(id),
  activated_at         timestamptz,
  trigger_reason       text,
  created_at           timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skill_versions_company_skill_idx
  ON skill_versions (company_id, skill_type);
CREATE INDEX IF NOT EXISTS skill_versions_status_idx
  ON skill_versions (status);

CREATE TABLE IF NOT EXISTS golden_datasets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  skill_type      text        NOT NULL,
  input           jsonb       NOT NULL,
  expected_output jsonb       NOT NULL,
  quality_score   integer,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS golden_datasets_company_skill_idx
  ON golden_datasets (company_id, skill_type);
