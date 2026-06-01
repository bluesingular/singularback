-- At 50 customers: AG-6, AG-7, AG-10, AG-11, Gap A, Gap D, Gap G, Gap I, Gap L

-- ── AG-6: Procedural memory ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS procedural_patterns (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  skill_id             UUID        REFERENCES company_skills(id) ON DELETE CASCADE,
  agent_id             UUID        REFERENCES agents(id) ON DELETE CASCADE,
  pattern_description  TEXT        NOT NULL,
  trigger_condition    TEXT        NOT NULL,
  behaviour            TEXT        NOT NULL,
  outcome_lift         DECIMAL(5,2),
  sample_size          INTEGER,
  confidence           DECIMAL(4,3),
  source               VARCHAR(30) NOT NULL
                       CHECK (source IN ('outcome_attribution','operator_correction','collective_intelligence')),
  active               BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS procedural_patterns_company_idx ON procedural_patterns (company_id, skill_id);

-- ── AG-7: Outcome attribution ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outcome_attributions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mission_id          UUID        REFERENCES missions(id) ON DELETE SET NULL,
  task_id             UUID        REFERENCES issues(id) ON DELETE CASCADE,
  agent_id            UUID        REFERENCES agents(id) ON DELETE CASCADE,
  skill_id            UUID        REFERENCES company_skills(id) ON DELETE SET NULL,
  outcome_value       VARCHAR(20) NOT NULL CHECK (outcome_value IN ('positive','negative','neutral')),
  contribution_score  DECIMAL(4,3),
  key_decision        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS outcome_attributions_company_idx ON outcome_attributions (company_id, created_at DESC);

-- ── AG-10: Behavioral baselines + anomalies ───────────────────────────────────

CREATE TABLE IF NOT EXISTS behavioral_baselines (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id            UUID          NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  company_id          UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  avg_judge_score     DECIMAL(4,2),
  avg_output_tokens   INTEGER,
  avg_tool_calls      DECIMAL(4,2),
  avg_execution_ms    INTEGER,
  approval_rate       DECIMAL(4,3),
  recycle_rate        DECIMAL(4,3),
  baseline_task_count INTEGER,
  established_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (skill_id, company_id)
);

CREATE TABLE IF NOT EXISTS behavioral_anomalies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID        NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric        VARCHAR(50) NOT NULL,
  baseline_val  DECIMAL(10,4),
  current_val   DECIMAL(10,4),
  deviation_pct DECIMAL(6,2),
  severity      VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high')),
  resolved      BOOLEAN     NOT NULL DEFAULT false,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS behavioral_anomalies_company_idx ON behavioral_anomalies (company_id, detected_at DESC);

-- ── AG-11: Cross-session narrative coherence ──────────────────────────────────

CREATE TABLE IF NOT EXISTS company_narrative (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  narrative_md TEXT        NOT NULL,
  key_events   JSONB       NOT NULL DEFAULT '[]',
  momentum     VARCHAR(20) NOT NULL CHECK (momentum IN ('accelerating','stable','decelerating')),
  focus_areas  TEXT[]      NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS company_narrative_company_idx ON company_narrative (company_id, period_start DESC);

-- ── Gap A: Skill variance metrics ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skill_variance_metrics (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id         UUID        NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start     DATE        NOT NULL,
  judge_score_mean DECIMAL(4,2),
  judge_score_std  DECIMAL(4,2),
  variance_flag    BOOLEAN     NOT NULL DEFAULT false,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS skill_variance_company_idx ON skill_variance_metrics (company_id, skill_id);

-- ── Gap D: Skill model pins ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skill_model_pins (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id     UUID        NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  model_version VARCHAR(100) NOT NULL,
  pinned_reason VARCHAR(50) NOT NULL
                CHECK (pinned_reason IN ('upgrade_blocked_by_regression','manual_pin')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (skill_id, company_id)
);

-- ── Gap G: Agent proposals ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_proposals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  proposing_agent_id   UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  proposed_agent_id    UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  trigger              TEXT        NOT NULL,
  proposed_task_brief  TEXT        NOT NULL,
  estimated_value      TEXT        NOT NULL,
  urgency              VARCHAR(20) NOT NULL CHECK (urgency IN ('high','normal','low')),
  status               VARCHAR(20) NOT NULL DEFAULT 'pending',
  decline_count        INTEGER     NOT NULL DEFAULT 0,
  expires_at           TIMESTAMPTZ NOT NULL,
  decided_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_proposals_company_idx ON agent_proposals (company_id, status, expires_at);

-- ── Gap I: Cost attribution per mission/goal/agent ───────────────────────────

ALTER TABLE cost_records
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal_id    UUID REFERENCES goals(id)    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cost_records_mission_idx ON cost_records (mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cost_records_goal_idx    ON cost_records (goal_id)    WHERE goal_id    IS NOT NULL;
