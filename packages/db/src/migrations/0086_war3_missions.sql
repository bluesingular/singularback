-- WAR-3: Mission tables.
-- Mission = CEO-level strategic intent (what the CEO wants).
-- Task (issue) = execution unit (what agents do).

CREATE TABLE IF NOT EXISTS missions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title          VARCHAR(200) NOT NULL,
  brief          TEXT        NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('draft','active','blocked','complete','archived')),
  orchestrator_id UUID       REFERENCES agents(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  archived_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS missions_company_status_idx
  ON missions (company_id, status);

CREATE TABLE IF NOT EXISTS mission_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID        NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('user','orchestrator','system')),
  content    TEXT        NOT NULL,
  agent_id   UUID        REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mission_messages_mission_idx
  ON mission_messages (mission_id, created_at);

CREATE TABLE IF NOT EXISTS mission_tasks (
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  task_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  PRIMARY KEY (mission_id, task_id)
);

-- FK from issues.mission_id now that missions table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'issues_mission_id_fkey'
  ) THEN
    ALTER TABLE issues
      ADD CONSTRAINT issues_mission_id_fkey
      FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL;
  END IF;
END
$$;
