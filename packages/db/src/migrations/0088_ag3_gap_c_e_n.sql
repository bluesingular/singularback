-- AG-3: Task checkpoints — resume long-horizon tasks from last successful step
-- AG-4: Confidence scores stored on judge_results (already exists)
-- Gap N: SLA tiers — sla_events table for breach compensation tracking

-- ── AG-3: Task checkpoints ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_checkpoints (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID    NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  company_id       UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  step_number      INTEGER NOT NULL,
  step_name        VARCHAR(100) NOT NULL,
  execution_state  JSONB   NOT NULL,
  context_snapshot JSONB,
  outputs_so_far   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_checkpoints_task_step_idx
  ON task_checkpoints (task_id, step_number DESC);

-- ── Gap N: SLA tiers + breach events ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sla_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type      VARCHAR(40) NOT NULL
                  CHECK (event_type IN ('breach','compensation_issued','resolved')),
  plan            VARCHAR(20) NOT NULL,
  metric          VARCHAR(40) NOT NULL,   -- 'resolution_time' | 'uptime' | 'export_time'
  threshold_value DECIMAL(10,4) NOT NULL,
  actual_value    DECIMAL(10,4) NOT NULL,
  breach_minutes  DECIMAL(10,2),
  credit_days     INTEGER NOT NULL DEFAULT 0,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sla_events_company_idx
  ON sla_events (company_id, created_at DESC);

-- ── Gap C: trust bootstrapping score column on companies ──────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bootstrapped_trust_score DECIMAL(3,2);
