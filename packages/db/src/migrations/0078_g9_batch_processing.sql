-- G9 — Batch processing
-- Fan-out N items to parallel BullMQ workers with a single approval gate
-- when all items complete.

CREATE TABLE batch_runs (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Which skill type drives this batch (e.g. "qualification-cv")
  skill_type          text         NOT NULL,
  -- Optional parent issue that triggered the batch
  parent_issue_id     uuid         REFERENCES issues(id) ON DELETE SET NULL,
  -- Optional agent that will execute each item
  agent_id            uuid         REFERENCES agents(id) ON DELETE SET NULL,
  -- Fan-out counters
  item_count          int          NOT NULL,
  completed_count     int          NOT NULL DEFAULT 0,
  failed_count        int          NOT NULL DEFAULT 0,
  -- pending | running | awaiting_approval | approved | rejected
  status              text         NOT NULL DEFAULT 'pending',
  created_by_user_id  text,
  approved_by_user_id text,
  approved_at         timestamptz,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE batch_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_run_id  uuid        NOT NULL REFERENCES batch_runs(id) ON DELETE CASCADE,
  company_id    uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Child issue created when the item is executed (nullable until execution starts)
  issue_id      uuid        REFERENCES issues(id) ON DELETE SET NULL,
  -- Position in the fan-out (0-indexed)
  item_index    int         NOT NULL,
  -- Per-item input payload (e.g. the CV JSON, email address, competitor URL)
  input         jsonb       NOT NULL,
  -- pending | running | done | failed
  status        text        NOT NULL DEFAULT 'pending',
  -- Output written by the worker when the item completes
  output        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX batch_runs_company_status_idx ON batch_runs (company_id, status);
CREATE INDEX batch_items_batch_run_idx     ON batch_items (batch_run_id);
