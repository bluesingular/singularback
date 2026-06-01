-- AG-15: Dynamic skill composition at runtime
-- Adds skill_overrides JSONB to missions. Overrides are mission-scoped only —
-- they never modify the agent's base configuration.
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS skill_overrides JSONB;

-- Gap O: Agent fleet registry
-- Cached fleet snapshot recomputed every 6 hours by the fleet-snapshot worker.
-- Internal Swwarm team tool — never exposed to customers.
CREATE TABLE IF NOT EXISTS fleet_snapshots (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_companies               INTEGER NOT NULL,
  total_active_agents           INTEGER NOT NULL,
  agents_by_status              JSONB   NOT NULL,  -- {active, paused, deactivated}
  skill_deployment_distribution JSONB   NOT NULL,  -- [{skill_slug, company_count}]
  model_version_distribution    JSONB   NOT NULL,  -- [{model, skill_count}]
  underperforming_agents        JSONB   NOT NULL,  -- [{skill_slug, avg_judge_score, company_count}]
  global_error_rate             NUMERIC(6,4) NOT NULL,
  computed_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep only the 48 most recent snapshots (8 days at 6-hour cadence)
CREATE INDEX IF NOT EXISTS fleet_snapshots_computed_at_idx ON fleet_snapshots (computed_at DESC);
