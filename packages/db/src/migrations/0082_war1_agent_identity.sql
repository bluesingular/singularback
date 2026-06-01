-- WAR-1: Agent identity fields required by the CEO Console operatives floor.
--
-- Adds five new columns to the agents table:
--   slug             — system identifier (immutable after set)
--   display_name     — customer-facing callsign (editable)
--   colour           — one of 6 approved hex values, immutable after set
--   soul_md          — identity layer: tone, persona, constraints, [[CONSTITUTION]]
--   team_roster_visible — whether the agent appears in the orchestrator team-roster.md
--
-- NOTE: We do NOT touch the existing 'status' column.  The current codebase
-- uses status values ('idle', 'running', 'terminated', 'pending_approval') for
-- the agent heartbeat lifecycle, which is a different concept from the WAR-1
-- operational state ('active' | 'paused' | 'deactivated').  The new status
-- semantics are enforced at the application layer in Swwarm-specific routes, not
-- at the DB level, to avoid breaking the existing heartbeat system.

-- 1. Add new columns (nullable first so existing rows are unaffected)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS slug                TEXT,
  ADD COLUMN IF NOT EXISTS display_name        TEXT,
  ADD COLUMN IF NOT EXISTS colour              TEXT NOT NULL DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS soul_md             TEXT,
  ADD COLUMN IF NOT EXISTS team_roster_visible BOOLEAN NOT NULL DEFAULT true;

-- 2. Backfill: existing agents get slug = id (unique, stable)
UPDATE agents SET slug = id::text WHERE slug IS NULL;

-- 3. Backfill: display_name falls back to name
UPDATE agents SET display_name = name WHERE display_name IS NULL;

-- 4. Enforce NOT NULL on slug and display_name (all rows now populated)
ALTER TABLE agents
  ALTER COLUMN slug         SET NOT NULL,
  ALTER COLUMN display_name SET NOT NULL;

-- 5. Unique slug per company
CREATE UNIQUE INDEX IF NOT EXISTS agents_company_slug_idx
  ON agents (company_id, slug);

-- 6. Colour CHECK — only the 6 approved palette values
ALTER TABLE agents
  ADD CONSTRAINT agents_colour_check
    CHECK (colour IN ('#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#14B8A6'));
