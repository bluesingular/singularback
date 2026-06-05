-- C1 — Task state machine
-- Enforces valid status transitions on the issues (tasks) table at the DB level.
-- Any UPDATE that attempts an invalid transition throws immediately, preventing
-- corrupted task states regardless of which code path triggered the change.
--
-- State map covers both Paperclip base states AND Swwarm additions:
--   backlog / todo / in_progress / in_review / blocked / done / cancelled
--   + pending_approval / awaiting_clarification / failed / partial_complete
--   + timed_out / expired_needs_clarification
--
-- Derived from auditing every db.update(issues).set({ status }) call in the codebase:
--
--   partial-output.ts:  partial_complete → done
--                       partial_complete → in_progress  (retry failed items)
--   dag.ts:             blocked → todo                   (release when blockers clear)
--                       ANY_NON_TERMINAL → blocked       (add dependency)
--   a2a/server.ts:      ANY_NON_TERMINAL → cancelled     (guarded: not done/cancelled)
--   clarifications.ts:  in_progress → awaiting_clarification  (no source guard in code)
--                       awaiting_clarification → in_progress  (answer received)
--                       awaiting_clarification → cancelled
--                       awaiting_clarification → blocked      (admin declines clarification)
--   clarificationTimeout.worker: awaiting_clarification → blocked (timeout)
--
-- "Non-terminal" = anything except done and cancelled.
-- Both done and cancelled allow reopen → todo for human workflows.

CREATE OR REPLACE FUNCTION enforce_task_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "backlog":                     ["todo","in_progress","blocked","cancelled","awaiting_clarification"],
    "todo":                        ["in_progress","blocked","cancelled","backlog","done","in_review","pending_approval","awaiting_clarification"],
    "in_progress":                 ["in_review","pending_approval","awaiting_clarification","done","failed","cancelled","blocked","partial_complete","todo"],
    "in_review":                   ["done","in_progress","cancelled","todo","failed","blocked"],
    "pending_approval":            ["done","in_progress","cancelled","todo","failed","blocked"],
    "awaiting_clarification":      ["in_progress","blocked","cancelled","expired_needs_clarification"],
    "blocked":                     ["todo","in_progress","cancelled"],
    "partial_complete":            ["done","cancelled","in_progress","todo","blocked"],
    "failed":                      ["todo","cancelled","in_progress","blocked"],
    "timed_out":                   ["todo","cancelled"],
    "expired_needs_clarification": ["todo","cancelled"],
    "done":                        ["todo","cancelled"],
    "cancelled":                   ["todo"]
  }';
BEGIN
  -- Only enforce when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Unknown source status: allow (forward compatibility for new states)
  IF NOT (valid_transitions ? OLD.status) THEN
    RETURN NEW;
  END IF;

  -- Reject invalid transition
  IF NOT (valid_transitions->OLD.status ? NEW.status) THEN
    RAISE EXCEPTION 'Invalid task state transition: % → % (task_id: %)',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_state_machine ON issues;

CREATE TRIGGER task_state_machine
  BEFORE UPDATE OF status ON issues
  FOR EACH ROW
  EXECUTE FUNCTION enforce_task_state_transition();

CREATE INDEX IF NOT EXISTS issues_status_idx ON issues (status);
