-- F1: Memory conflict resolution — confidence scoring + superseded_by
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS confidence_score     DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS superseded_by        UUID         REFERENCES memory_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_reinforced_at   TIMESTAMPTZ;

-- F2: Memory staleness detection
ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS confidence_decay_at  TIMESTAMPTZ;

-- F3: Approval escalation path
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS approval_escalate_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_level     INTEGER NOT NULL DEFAULT 0;

-- F7: Task execution events — reasoning capture, tool calls, constitution revisions
CREATE TABLE IF NOT EXISTS task_execution_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  company_id UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_execution_events_task_idx ON task_execution_events (task_id);

-- P5: Transactional outbox for BullMQ jobs
CREATE TABLE IF NOT EXISTS pending_jobs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue      VARCHAR(50) NOT NULL,
  payload    JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pending_jobs_unsent_idx ON pending_jobs (created_at) WHERE sent_at IS NULL;

-- A3: Company DNA pack extensions
ALTER TABLE company_dna
  ADD COLUMN IF NOT EXISTS pack_extensions JSONB NOT NULL DEFAULT '{}';

-- AG-1: Mission context (shared working memory for parallel agents on same mission)
CREATE TABLE IF NOT EXISTS mission_context (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID        NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  context_key VARCHAR(100) NOT NULL,
  value       JSONB       NOT NULL,
  written_by  UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  written_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, context_key)
);
CREATE INDEX IF NOT EXISTS mission_context_mission_idx ON mission_context (mission_id);

-- AG-2: Agent-to-agent peer messages (informational only — no external actions)
CREATE TABLE IF NOT EXISTS agent_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID        NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_agent_id UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id   UUID        REFERENCES agents(id) ON DELETE SET NULL,
  content       TEXT        NOT NULL,
  message_type  VARCHAR(30) NOT NULL
                CHECK (message_type IN ('question','finding','confirmation','alert')),
  replied_at    TIMESTAMPTZ,
  reply_content TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_messages_mission_idx ON agent_messages (mission_id, created_at);
