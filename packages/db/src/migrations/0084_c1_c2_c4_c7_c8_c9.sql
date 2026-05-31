-- C1: Task state machine — PostgreSQL trigger enforces valid transitions.
--     Invalid status changes throw an exception at DB level (no bypass path).
-- C2: Contact event type 'external_communication' — enables collision detection.
-- C4: Company concurrency limit field — plan-level cap enforced by worker.
-- C7: security_events table — logs injection attempts and scope violations.
-- C8: judge_results table — LLM-as-judge scores per task output.
-- C9: Constitutional self-critique flag on issues.

-- ── C1: Task state machine trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_task_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "backlog":      ["todo","in_progress","done","cancelled","blocked"],
    "todo":         ["in_progress","done","cancelled","blocked","backlog"],
    "in_progress":  ["in_review","blocked","done","cancelled","todo","backlog"],
    "in_review":    ["in_progress","done","cancelled","blocked"],
    "blocked":      ["todo","in_progress","done","cancelled"],
    "done":         ["todo","backlog"],
    "cancelled":    ["todo","backlog"]
  }';
BEGIN
  -- Only validate when status is actually changing
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (valid_transitions->OLD.status ? NEW.status) THEN
    RAISE EXCEPTION 'Invalid task state transition: % → % (issue id: %)',
      OLD.status, NEW.status, OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate so function changes take effect
DROP TRIGGER IF EXISTS task_state_machine ON issues;

CREATE TRIGGER task_state_machine
  BEFORE UPDATE OF status ON issues
  FOR EACH ROW
  EXECUTE FUNCTION enforce_task_state_transition();

-- ── C2: Ensure contact_events.event_type allows 'external_communication' ─────
-- The column is text with no CHECK constraint — no migration needed for values.
-- Add index on (company_id, contact_id, event_type, occurred_at) for collision query.

CREATE INDEX IF NOT EXISTS contact_events_collision_idx
  ON contact_events (company_id, contact_id, event_type, occurred_at DESC)
  WHERE event_type = 'external_communication';

-- ── C4: Company concurrency limit ─────────────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS max_concurrent_tasks INTEGER NOT NULL DEFAULT 5;

-- Seed correct defaults per plan (will be set by plan upgrade flow going forward)
UPDATE companies SET max_concurrent_tasks = 2  WHERE plan = 'solo';
UPDATE companies SET max_concurrent_tasks = 5  WHERE plan = 'growth' OR plan IS NULL;
UPDATE companies SET max_concurrent_tasks = 10 WHERE plan = 'pro';
UPDATE companies SET max_concurrent_tasks = 25 WHERE plan = 'enterprise';

-- ── C7: Security events table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id    UUID        REFERENCES issues(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  severity   VARCHAR(20) NOT NULL
             CHECK (severity IN ('low','medium','high','critical')),
  payload    JSONB       NOT NULL,
  resolved   BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_company_idx
  ON security_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_unresolved_idx
  ON security_events (company_id, severity)
  WHERE resolved = false;

-- ── C8: Judge results table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS judge_results (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_id        UUID          NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  output_version INTEGER       NOT NULL DEFAULT 1,
  judge_model    VARCHAR(60)   NOT NULL,
  dimensions     JSONB         NOT NULL,
  overall_score  DECIMAL(4,2)  NOT NULL,
  auto_recycled  BOOLEAN       NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS judge_results_task_idx
  ON judge_results (task_id, output_version DESC);

-- ── C9: Constitutional revision flag on task execution events ─────────────────
-- task_execution_events already has event_type text — 'constitution_revision'
-- is just a new value. No schema change needed.
-- Add constitution_revised flag on issues for quick querying.

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS constitution_revised BOOLEAN NOT NULL DEFAULT false;
