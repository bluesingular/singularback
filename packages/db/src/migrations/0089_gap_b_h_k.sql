-- Gap B: Inline output editing — training signal on approval cards
-- Gap H: Partial output delivery — new task status
-- Gap J: Pack migration steps — declared in pack manifest
-- Gap K: Session gap awareness — last_active_at on users

-- ── Gap H: partial_complete status ───────────────────────────────────────────
-- Extend state machine to allow partial_complete as a valid status
-- (operator can approve partial | request completion | reject all)
-- partial_complete → appears in 'Votre attention' column

-- Add partial_complete to the state machine trigger
CREATE OR REPLACE FUNCTION enforce_task_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "backlog":                    ["todo","in_progress","done","cancelled","blocked","awaiting_clarification"],
    "todo":                       ["in_progress","done","cancelled","blocked","backlog","awaiting_clarification"],
    "in_progress":                ["in_review","blocked","done","cancelled","todo","backlog","awaiting_clarification","partial_complete"],
    "in_review":                  ["in_progress","done","cancelled","blocked","awaiting_clarification"],
    "blocked":                    ["todo","in_progress","done","cancelled","awaiting_clarification"],
    "awaiting_clarification":     ["in_progress","todo","cancelled","blocked"],
    "partial_complete":           ["in_progress","done","cancelled"],
    "done":                       ["todo","backlog"],
    "cancelled":                  ["todo","backlog"]
  }';
BEGIN
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

-- ── Gap B: Inline edits on approval outputs ───────────────────────────────────

ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS operator_edit      TEXT,
  ADD COLUMN IF NOT EXISTS edit_char_count    INTEGER,
  ADD COLUMN IF NOT EXISTS edit_recorded_at   TIMESTAMPTZ;

-- ── Gap K: Session gap awareness ─────────────────────────────────────────────
-- Note: better-auth manages the "user" table (aliased as auth_users in Drizzle)

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_last_active_idx
  ON "user" (last_active_at);
