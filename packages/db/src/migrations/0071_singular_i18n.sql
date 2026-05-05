-- G1: i18n architecture — add locale + timezone to companies
-- locale: BCP-47 language tag (e.g. 'fr', 'en')
-- timezone: IANA timezone string (e.g. 'Europe/Paris')

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "locale" text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'Europe/Paris';
