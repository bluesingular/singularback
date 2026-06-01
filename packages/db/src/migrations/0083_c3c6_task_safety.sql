-- C3 + C6: Task cancellation and failure reason taxonomy.
--
-- cancel_requested  — set true by the cancel API endpoint; workers poll this
--                     at every step boundary and throw TaskCancelledException.
-- failure_reason    — enum-style field recording WHY a task failed, so operators
--                     always receive a plain-French actionable message (never
--                     a raw exception string).
-- mission_id        — nullable UUID linking this task to a CEO-level mission.
--                     FK to missions(id) will be added in migration 0087 once
--                     the missions table exists.

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failure_reason   TEXT,
  ADD COLUMN IF NOT EXISTS mission_id       UUID;

-- failure_reason CHECK: only the 6 canonical values (or NULL = no failure)
ALTER TABLE issues
  ADD CONSTRAINT issues_failure_reason_check
    CHECK (failure_reason IS NULL OR failure_reason IN (
      'failed_schema_validation',
      'failed_quality_gate',
      'failed_llm_unavailable',
      'failed_tool_error',
      'failed_budget_exceeded',
      'failed_permanent'
    ));

-- Index for mission→tasks lookups (used heavily in CEO Console board view)
CREATE INDEX IF NOT EXISTS issues_mission_id_idx
  ON issues (mission_id)
  WHERE mission_id IS NOT NULL;

-- Index for the cancel-poll query: worker checks cancel_requested quickly
CREATE INDEX IF NOT EXISTS issues_cancel_requested_idx
  ON issues (id, cancel_requested)
  WHERE cancel_requested = true;
