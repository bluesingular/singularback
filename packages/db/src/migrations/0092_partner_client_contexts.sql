-- §34 Partner Programme + §35 Client Context Architecture

-- ── §34.2: Partner flags on users ────────────────────────────────────────────

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS is_partner          BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_certified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partner_tier         VARCHAR(20)
    CHECK (partner_tier IN ('certified','silver','gold'));

-- ── §34.2: Referral tracking on companies ────────────────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS referred_by_partner_id TEXT,
  ADD COLUMN IF NOT EXISTS referral_fee_paid       BOOLEAN NOT NULL DEFAULT false;

-- ── §34.2: Partner referral fees ─────────────────────────────────────────────
-- Created after 60 days active subscription — never at sign-up

CREATE TABLE IF NOT EXISTS partner_referral_fees (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   TEXT        NOT NULL,
  company_id   UUID        NOT NULL REFERENCES companies(id)  ON DELETE CASCADE,
  amount_eur   DECIMAL(8,2) NOT NULL,
  paid_at      TIMESTAMPTZ,
  payment_ref  VARCHAR(100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS partner_referral_fees_partner_idx ON partner_referral_fees (partner_id, created_at DESC);

-- ── §34.3: White-label config ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partner_white_label_config (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      TEXT        NOT NULL,
  brand_name      VARCHAR(100) NOT NULL,
  logo_url        VARCHAR(500),
  primary_colour  VARCHAR(7),
  support_email   VARCHAR(200),
  custom_domain   VARCHAR(200),
  show_powered_by BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id)
);

-- ── §35.2: Client contexts table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_contexts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  client_dna  JSONB       NOT NULL DEFAULT '{}',
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','paused','archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, slug)
);
CREATE INDEX IF NOT EXISTS client_contexts_company_idx ON client_contexts (company_id, status);

-- ── §35.2: Scope org_memory, tasks, missions, goals to client contexts ────────
-- NULL = firm-level (belongs to consulting firm, not any specific client)
-- ON DELETE SET NULL: if client context deleted, data is anonymised, not lost

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS client_context_id UUID REFERENCES client_contexts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS memory_client_context_idx ON memory_entries (company_id, client_context_id);

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS client_context_id UUID REFERENCES client_contexts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS issues_client_context_idx ON issues (company_id, client_context_id);

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS client_context_id UUID REFERENCES client_contexts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS missions_client_context_idx ON missions (company_id, client_context_id);

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS client_context_id UUID REFERENCES client_contexts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS goals_client_context_idx ON goals (company_id, client_context_id);

-- ── §35.6: Client skill overlays ─────────────────────────────────────────────
-- Thin per-client layer on top of tenant's evolved skill copy

CREATE TABLE IF NOT EXISTS client_skill_overlays (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_context_id            UUID        NOT NULL REFERENCES client_contexts(id) ON DELETE CASCADE,
  skill_id                     UUID        NOT NULL REFERENCES company_skills(id) ON DELETE CASCADE,
  additional_soul_instructions TEXT,
  quality_threshold_adjustment DECIMAL(3,2),
  preferred_tone_override      VARCHAR(30) CHECK (preferred_tone_override IN ('formal','balanced','casual')),
  sector_vocabulary            TEXT[]      NOT NULL DEFAULT '{}',
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_context_id, skill_id)
);
CREATE INDEX IF NOT EXISTS client_skill_overlays_ctx_idx ON client_skill_overlays (company_id, client_context_id);
