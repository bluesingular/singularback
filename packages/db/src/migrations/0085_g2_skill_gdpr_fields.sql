-- G2: Capability declaration — add GDPR/tier/AI Act fields to company_skills.
--
-- These fields mirror the ParsedSkill frontmatter from SKILL.md and are stored
-- in the DB so LLM routing (RULE 1) can enforce GDPR-safe model selection
-- without re-parsing the full markdown on every task execution.
--
-- Also extends the C1 state machine to include awaiting_clarification, which
-- the clarification route sets directly and must be a valid transition target.

-- ── G2: company_skills capability columns ─────────────────────────────────────

ALTER TABLE company_skills
  ADD COLUMN IF NOT EXISTS gdpr_required    BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tier             SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_act_risk      TEXT     NOT NULL DEFAULT 'minimal'
    CHECK (ai_act_risk IN ('minimal','limited','high','unacceptable'));

-- ── C1 fix: add awaiting_clarification to state machine ───────────────────────

CREATE OR REPLACE FUNCTION enforce_task_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "backlog":                    ["todo","in_progress","done","cancelled","blocked","awaiting_clarification"],
    "todo":                       ["in_progress","done","cancelled","blocked","backlog","awaiting_clarification"],
    "in_progress":                ["in_review","blocked","done","cancelled","todo","backlog","awaiting_clarification"],
    "in_review":                  ["in_progress","done","cancelled","blocked","awaiting_clarification"],
    "blocked":                    ["todo","in_progress","done","cancelled","awaiting_clarification"],
    "awaiting_clarification":     ["in_progress","todo","cancelled","blocked"],
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

-- Trigger already exists from 0084 — function replace above is sufficient.
