-- M11: Morning intelligence cards + activation sequence moments
-- ────────────────────────────────────────────────────────────────────────────
-- Drizzle migration — do not edit once applied.

CREATE TABLE IF NOT EXISTS intelligence_cards (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  card_type    text        NOT NULL,
  title        text        NOT NULL,
  body         text        NOT NULL,
  urgency      integer     NOT NULL DEFAULT 3,
  action_url   text,
  status       text        NOT NULL DEFAULT 'unread',
  insight_key  text        NOT NULL,
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_cards_company_idx
  ON intelligence_cards (company_id);
CREATE INDEX IF NOT EXISTS intelligence_cards_status_idx
  ON intelligence_cards (status);
CREATE INDEX IF NOT EXISTS intelligence_cards_insight_key_idx
  ON intelligence_cards (company_id, insight_key);

CREATE TABLE IF NOT EXISTS activation_moments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pack_slug    text        NOT NULL,
  trigger_key  text        NOT NULL,
  fired        boolean     NOT NULL DEFAULT false,
  fired_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, pack_slug, trigger_key)
);

CREATE INDEX IF NOT EXISTS activation_moments_company_pack_idx
  ON activation_moments (company_id, pack_slug);
