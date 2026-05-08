-- G7 — Skill version pin
-- Pins the active skill version to a task at creation/assignment time.
-- Skill updates (new versions activated) apply only to new tasks.

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS skill_type       text,
  ADD COLUMN IF NOT EXISTS skill_version_id uuid REFERENCES skill_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS issues_skill_version_idx
  ON issues (skill_version_id)
  WHERE skill_version_id IS NOT NULL;
