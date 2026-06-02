-- Three-tier skill architecture foundation.
--
-- Tier 1: Platform master skills     → source_company_id IS NULL, company_id = platform sentinel
-- Tier 2: Tenant copies (pack install) → source_company_id IS NULL (tenant owns copy), source_skill_id = master.id
-- Tier 3: Client overlays            → client_skill_overlays table (already exists)
--
-- The platform sentinel company is created here with a fixed UUID so master
-- skills can be stored in company_skills without a nullable company_id column.

-- Platform sentinel company (Swwarm internal — not a real customer)
INSERT INTO companies (
  id, name, slug, plan, status, issue_prefix
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Swwarm Platform',
  'swwarm-platform',
  'enterprise',
  'active',
  'PLT'
) ON CONFLICT (id) DO NOTHING;

-- Add source_company_id to company_skills so we can identify master skills
-- (rows where source_company_id IS NULL AND company_id = platform sentinel)
-- vs tenant copies (source_company_id IS NULL, source_skill_id points to master).
ALTER TABLE company_skills
  ADD COLUMN IF NOT EXISTS source_company_id UUID REFERENCES companies(id);

-- Index for efficient master skill lookup
CREATE INDEX IF NOT EXISTS company_skills_master_idx
  ON company_skills (source_skill_id)
  WHERE source_skill_id IS NOT NULL;

-- Index for finding all tenant copies of a given master
CREATE INDEX IF NOT EXISTS company_skills_source_idx
  ON company_skills (source_skill_id, company_id)
  WHERE source_skill_id IS NOT NULL;
