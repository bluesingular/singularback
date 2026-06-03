-- Fix company_skills FK: add ON DELETE CASCADE so deleting a company
-- does not violate the constraint. Tests that clean up company rows were
-- failing with "violates foreign key constraint company_skills_company_id_companies_id_fk".

ALTER TABLE company_skills
  DROP CONSTRAINT IF EXISTS company_skills_company_id_companies_id_fk;

ALTER TABLE company_skills
  ADD CONSTRAINT company_skills_company_id_companies_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
