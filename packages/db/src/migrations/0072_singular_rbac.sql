-- G3: RBAC — canonicalise role names
-- Renames legacy 'manager' memberships to 'operator' (the new canonical name).
-- 'owner', 'admin', 'viewer' are unchanged.
-- New 'api' role is assigned at runtime to agent service accounts (no DB rows needed).

UPDATE "company_memberships"
SET "membership_role" = 'operator'
WHERE "membership_role" = 'manager';
