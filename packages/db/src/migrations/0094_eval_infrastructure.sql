-- §31.4 AI Evaluation Infrastructure + §31.5 Embedding Metrics + Away Mode

-- ── §31.4: Hallucination checks ──────────────────────────────────────────────
-- Stored per task output — verdict for each extracted factual claim

CREATE TABLE IF NOT EXISTS hallucination_checks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  company_id UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  output_id  VARCHAR(100) NOT NULL,
  claim      TEXT        NOT NULL,
  source     TEXT,
  verdict    VARCHAR(20) NOT NULL CHECK (verdict IN ('supported','unsupported','contradicted')),
  confidence DECIMAL(4,3) NOT NULL,
  blocked    BOOLEAN     NOT NULL DEFAULT false,  -- true if contradicted → routes to damage control
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hallucination_task_idx ON hallucination_checks (task_id);
CREATE INDEX IF NOT EXISTS hallucination_company_idx ON hallucination_checks (company_id, created_at DESC);

-- ── §31.4: Skill regression results ──────────────────────────────────────────
-- Written per skill version update before promotion

CREATE TABLE IF NOT EXISTS skill_regression_results (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id              UUID        NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  company_id            UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version_candidate     VARCHAR(20) NOT NULL,
  version_baseline      VARCHAR(20) NOT NULL,
  examples_run          INTEGER     NOT NULL,
  avg_quality_candidate DECIMAL(4,2) NOT NULL,
  avg_quality_baseline  DECIMAL(4,2) NOT NULL,
  delta                 DECIMAL(4,2) NOT NULL,  -- candidate - baseline
  promoted              BOOLEAN     NOT NULL DEFAULT false,
  blocked_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS regression_skill_idx ON skill_regression_results (skill_id, created_at DESC);

-- ── §31.4: Autonomy safety evaluations ───────────────────────────────────────
-- Gating check before any tier upgrade (supervised → spot_checked → autonomous)

CREATE TABLE IF NOT EXISTS autonomy_safety_evals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id        UUID        NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  current_tier    VARCHAR(20) NOT NULL,
  proposed_tier   VARCHAR(20) NOT NULL,
  edge_cases_run  INTEGER     NOT NULL DEFAULT 0,
  safe_responses  INTEGER     NOT NULL DEFAULT 0,
  unsafe_responses INTEGER    NOT NULL DEFAULT 0,
  safety_rate     DECIMAL(4,3) NOT NULL DEFAULT 0,
  passed          BOOLEAN     NOT NULL DEFAULT false,
  blocking_cases  JSONB       NOT NULL DEFAULT '[]',  -- edge cases that failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS safety_eval_skill_idx ON autonomy_safety_evals (skill_id, created_at DESC);

-- ── §31.4: Memory correctness tests ──────────────────────────────────────────
-- Canonical queries per company with expected answers (set at pack install)

CREATE TABLE IF NOT EXISTS memory_correctness_tests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  query          TEXT        NOT NULL,
  expected_answer TEXT       NOT NULL,
  actual_answer  TEXT,
  match_score    DECIMAL(4,3),
  passed         BOOLEAN     NOT NULL DEFAULT false,
  run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS memory_test_company_idx ON memory_correctness_tests (company_id, run_at DESC);

-- ── §31.5: Embedding metrics ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS embedding_metrics (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  week_start             DATE        NOT NULL,
  tasks_by_agent         JSONB       NOT NULL DEFAULT '{}',
  distinct_workflow_types INTEGER     NOT NULL DEFAULT 0,
  human_time_saved_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  autonomous_task_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
  embedding_score        DECIMAL(5,2) NOT NULL DEFAULT 0,
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, week_start)
);
CREATE INDEX IF NOT EXISTS embedding_metrics_company_idx ON embedding_metrics (company_id, week_start DESC);

-- ── §11.6: Away mode ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS away_mode (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         TEXT        NOT NULL,  -- references "user".id (text PK)
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  -- Catch-up briefing generated on return
  briefing_md     TEXT,
  briefing_ready  BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one active away period per user
  UNIQUE (company_id, user_id, starts_at)
);
CREATE INDEX IF NOT EXISTS away_mode_company_idx ON away_mode (company_id, ends_at DESC);
