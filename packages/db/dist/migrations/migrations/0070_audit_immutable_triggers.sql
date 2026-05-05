-- RULE 4 hardening: replace DO INSTEAD NOTHING rules with exception-raising triggers
-- Previous migration used PostgreSQL rules that silently swallowed UPDATE/DELETE.
-- RULE 4 requires the operation to actually fail at DB level with an error.

-- Drop the old silent rules
DO $$ BEGIN
  DROP RULE IF EXISTS audit_no_update ON audit_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  DROP RULE IF EXISTS audit_no_delete ON audit_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Trigger function that raises an exception for any modification attempt
CREATE OR REPLACE FUNCTION fn_audit_entries_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_entries is immutable: % operations are not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Trigger: block UPDATE
DO $$ BEGIN
  CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON audit_entries
    FOR EACH ROW EXECUTE FUNCTION fn_audit_entries_immutable();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: block DELETE
DO $$ BEGIN
  CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON audit_entries
    FOR EACH ROW EXECUTE FUNCTION fn_audit_entries_immutable();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
