-- M9: Trust calibration system
-- trust_scores (per agent per skill type) + trust_proposals
-- ────────────────────────────────────────────────────────────────────────────
-- Drizzle migration — do not edit once applied.

CREATE TABLE IF NOT EXISTS trust_scores (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id          uuid         NOT NULL REFERENCES agents(id)   ON DELETE CASCADE,
  skill_type        text         NOT NULL,
  score             numeric(4,2) NOT NULL DEFAULT 0,
  autonomy_level    text         NOT NULL DEFAULT 'building',
  approval_streak   integer      NOT NULL DEFAULT 0,
  quality_rating_avg numeric(4,2),
  gate_pass_rate     numeric(4,2),
  schema_pass_rate   numeric(4,2),
  task_count_window  integer      NOT NULL DEFAULT 0,
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trust_scores_agent_skill_unique
  ON trust_scores (agent_id, skill_type);
CREATE INDEX IF NOT EXISTS trust_scores_company_idx
  ON trust_scores (company_id);

CREATE TABLE IF NOT EXISTS trust_proposals (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id        uuid         NOT NULL REFERENCES agents(id)   ON DELETE CASCADE,
  skill_type      text         NOT NULL,
  current_level   text         NOT NULL,
  proposed_level  text         NOT NULL,
  trust_score     numeric(4,2) NOT NULL,
  approval_streak integer      NOT NULL,
  evidence        jsonb        NOT NULL,
  status          text         NOT NULL DEFAULT 'pending',
  reviewed_at     timestamptz,
  reviewed_by     uuid,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trust_proposals_company_idx ON trust_proposals (company_id);
CREATE INDEX IF NOT EXISTS trust_proposals_agent_idx   ON trust_proposals (agent_id);
CREATE INDEX IF NOT EXISTS trust_proposals_status_idx  ON trust_proposals (status);
