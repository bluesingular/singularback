-- §20: Master skill update notification system.
-- When the platform publishes a new version of a master skill, all tenants
-- that copied it receive a pending notification they can accept or dismiss.

CREATE TABLE IF NOT EXISTS skill_update_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_skill_id UUID NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  tenant_skill_id UUID NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  new_version     VARCHAR(20) NOT NULL,
  changelog       TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'dismissed', 'merged')),
  merge_strategy  VARCHAR(20) NOT NULL DEFAULT 'take_master'
                  CHECK (merge_strategy IN ('take_master', 'manual_review')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at      TIMESTAMPTZ,
  UNIQUE (tenant_skill_id, new_version)
);

CREATE INDEX IF NOT EXISTS skill_update_notifications_company_idx
  ON skill_update_notifications (company_id, status);

CREATE INDEX IF NOT EXISTS skill_update_notifications_master_idx
  ON skill_update_notifications (master_skill_id, status);
