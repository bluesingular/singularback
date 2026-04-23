-- Migration: 0060_singular_quality_gates.sql
-- M6: Quality gates, output schema validation, immutable audit trail, damage control

-- ── Quality gates ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quality_gates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES agents(id) ON DELETE CASCADE,
  gate_type   TEXT NOT NULL CHECK (gate_type IN (
                'volume_limit','recipient_whitelist','budget_limit',
                'content_forbidden','custom'
              )),
  config      JSONB NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quality_gates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY quality_gates_company_isolation ON quality_gates
    USING (company_id = current_setting('app.company_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_gates_company_agent ON quality_gates(company_id, agent_id, enabled);

-- ── Gate violations ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gate_violations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gate_id     UUID NOT NULL REFERENCES quality_gates(id),
  agent_id    UUID REFERENCES agents(id),
  task_id     UUID,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  violation   TEXT NOT NULL,
  resolution  TEXT CHECK (resolution IN ('blocked','escalated','overridden')),
  resolved_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE gate_violations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY gate_violations_company_isolation ON gate_violations
    USING (company_id = current_setting('app.company_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_violations_company ON gate_violations(company_id, created_at DESC);

-- ── Immutable audit trail (AI Act Art. 12) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES agents(id),
  user_id     TEXT,
  task_id     UUID,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  result      TEXT NOT NULL CHECK (result IN (
                'success','blocked','escalated','approved','rejected'
              )),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RULE 4: immutable at DB level — no UPDATE, no DELETE
DO $$ BEGIN
  CREATE RULE audit_no_update AS ON UPDATE TO audit_entries DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE RULE audit_no_delete AS ON DELETE TO audit_entries DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE audit_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY audit_entries_company_isolation ON audit_entries
    USING (company_id = current_setting('app.company_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_entries(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_agent   ON audit_entries(agent_id, created_at DESC);

-- ── Damage control events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS damage_control_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id         UUID NOT NULL REFERENCES agents(id),
  task_id          UUID NOT NULL,
  error_type       TEXT NOT NULL CHECK (error_type IN (
                     'wrong_tone','wrong_recipient','incorrect_info','should_not_send'
                   )),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending','in_progress','resolved'
                   )),
  recovery_actions JSONB,
  contact_name     TEXT,
  topic            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

ALTER TABLE damage_control_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY damage_control_company_isolation ON damage_control_events
    USING (company_id = current_setting('app.company_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
