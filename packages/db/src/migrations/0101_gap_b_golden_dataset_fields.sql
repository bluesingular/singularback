-- Gap B: add weight, source, task_id to golden_datasets
-- weight 3.0 = operator inline edit (highest training signal)
-- weight 2.0 = live teaching
-- weight 1.0 = outcome-attributed
-- source: 'inline_approval_edit' | 'live_teaching' | 'outcome_attribution' | 'manual'
-- task_id: links training example to the task it came from (nullable — manual examples have none)

ALTER TABLE golden_datasets
  ADD COLUMN IF NOT EXISTS weight     DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS source     TEXT         NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS task_id    UUID         REFERENCES issues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_output TEXT;

-- index for efficient self-improvement queries by source/weight
CREATE INDEX IF NOT EXISTS golden_datasets_source_idx
  ON golden_datasets (company_id, skill_type, source);
