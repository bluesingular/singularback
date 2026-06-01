-- §20: Skill lineage — track which master skill each tenant copy originated from.
-- Written at pack install time; NULL means the skill was created directly (not from a master).
ALTER TABLE company_skills
  ADD COLUMN IF NOT EXISTS source_skill_id UUID,
  ADD COLUMN IF NOT EXISTS master_version  TEXT;
