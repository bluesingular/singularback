-- Migration: 0057_singular_multi_tenancy.sql
-- Extends the Paperclip base schema with Singular.blue multi-tenancy requirements.
-- companies, company_memberships, user, session already exist — this adds missing columns only.
-- Never alters existing migration files.

-- ── 1. Extend companies ───────────────────────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS slug                 TEXT,
  ADD COLUMN IF NOT EXISTS plan                 TEXT NOT NULL DEFAULT 'growth',
  ADD COLUMN IF NOT EXISTS tasks_used_month     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasks_limit_month    INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS tokens_used_month    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_limit_month   BIGINT NOT NULL DEFAULT 20000000,
  ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  ADD COLUMN IF NOT EXISTS stripe_customer_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_sub_id        TEXT;

-- Backfill slug for any existing rows before adding NOT NULL + UNIQUE
UPDATE companies
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

ALTER TABLE companies ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

DO $$ BEGIN
  ALTER TABLE companies ADD CONSTRAINT companies_plan_check
    CHECK (plan IN ('solo', 'growth', 'pro', 'enterprise'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend status to include suspended/churned
-- Drop the Drizzle-generated constraint (name may vary) then re-add with full set of values
DO $$
DECLARE
  c TEXT;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'companies'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE companies DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END$$;

DO $$ BEGIN
  ALTER TABLE companies ADD CONSTRAINT companies_status_check
    CHECK (status IN ('active', 'paused', 'suspended', 'churned'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Add company_id to session (company switcher) ───────────────────────────
-- session.user_id is TEXT (better-auth); company_id links to the active company context.
-- Nullable: a session exists before a company is chosen (OAuth callback → switcher sets it).

ALTER TABLE session
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_user_id    ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_company_id ON session(company_id);

-- ── 3. Extend company_memberships ─────────────────────────────────────────────
-- invited_by references "user".id which is TEXT (better-auth)

ALTER TABLE company_memberships
  ADD COLUMN IF NOT EXISTS invited_by TEXT,  -- better-auth user id (TEXT pk — no FK needed)
  ADD COLUMN IF NOT EXISTS joined_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- membership_role is free-text (values: 'owner', 'member', etc.) — no CHECK constraint needed

-- ── 4. Indexes for high-frequency multi-tenant queries ────────────────────────

CREATE INDEX IF NOT EXISTS idx_agents_company_id
  ON agents(company_id);

CREATE INDEX IF NOT EXISTS idx_issues_company_status
  ON issues(company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goals_company_id
  ON goals(company_id);

CREATE INDEX IF NOT EXISTS idx_members_company_id
  ON company_memberships(company_id, status);

CREATE INDEX IF NOT EXISTS idx_members_principal
  ON company_memberships(principal_type, principal_id, status);

-- ── 5. Row-level security with SET LOCAL isolation ────────────────────────────
-- Strategy: app middleware does SET LOCAL app.company_id = '<uuid>' at the start
-- of every transaction. SET LOCAL resets automatically at transaction end, making
-- this safe with connection pools (PgBouncer in transaction mode).
--
-- current_setting('app.company_id', true) — the `true` flag returns NULL instead
-- of throwing when the variable is unset (migrations, admin scripts, health checks).
-- Those contexts bypass RLS because no company_id is set and the policy returns NULL,
-- which PostgreSQL treats as "no row matches" — i.e. safe fail-closed behaviour.
-- Use SET ROLE or BYPASSRLS for legitimate admin operations.

ALTER TABLE agents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues  ENABLE ROW LEVEL SECURITY;

-- BYPASSRLS: superuser and roles with BYPASSRLS skip these policies (migrations, seeds).
-- All application connections must NOT have BYPASSRLS.

DO $$ BEGIN
  CREATE POLICY agents_company_isolation ON agents
    USING (company_id = current_setting('app.company_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY goals_company_isolation ON goals
    USING (company_id = current_setting('app.company_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY issues_company_isolation ON issues
    USING (company_id = current_setting('app.company_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
