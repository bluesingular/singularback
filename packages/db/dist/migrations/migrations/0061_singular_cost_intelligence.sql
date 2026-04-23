-- Migration: 0061_singular_cost_intelligence.sql
-- M7: Cost intelligence — cost_records table + monthly summary materialized view

CREATE TABLE cost_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id      UUID REFERENCES agents(id),
  task_id       UUID,
  model         TEXT NOT NULL,
  tier          SMALLINT NOT NULL,          -- 0, 1, 2, 3
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_eur_micro INTEGER NOT NULL,          -- cost in micro-euros (no float rounding)
  billing_month TEXT NOT NULL,             -- 'YYYY-MM'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_records_company_isolation ON cost_records
  USING (company_id = current_setting('app.company_id', true)::uuid);

CREATE INDEX idx_cost_company_month ON cost_records(company_id, billing_month);
CREATE INDEX idx_cost_agent_month   ON cost_records(agent_id, billing_month);

-- Materialized view for fast dashboard queries
-- Refreshed by the monthly reset worker (M1 CostResetWorker)
CREATE MATERIALIZED VIEW cost_monthly_summary AS
SELECT
  company_id,
  billing_month,
  SUM(cost_eur_micro)                               AS total_cost_micro,
  SUM(input_tokens + output_tokens)                 AS total_tokens,
  COUNT(*)                                          AS total_tasks,
  COUNT(DISTINCT agent_id)                          AS active_agents,
  SUM(CASE WHEN tier = 3 THEN 1 ELSE 0 END)        AS t3_task_count
FROM cost_records
GROUP BY company_id, billing_month;

CREATE UNIQUE INDEX ON cost_monthly_summary(company_id, billing_month);
