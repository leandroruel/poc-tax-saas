-- Stable cursor pagination uses tenant, creation time and UUIDv7 tie-breaker.
DROP INDEX IF EXISTS "Calculation_organizationId_createdAt_idx";
CREATE INDEX "Calculation_organizationId_createdAt_id_idx"
ON "Calculation" ("organizationId", "createdAt" DESC, "id" DESC);

-- PostgreSQL does not create an index for foreign keys automatically.
CREATE INDEX "Calculation_recalculatesId_idx"
ON "Calculation" ("recalculatesId");

-- A revision may only point at a calculation owned by the same organization.
-- The application performs the same check to return a useful HTTP error; this
-- trigger is the final protection for every writer, including maintenance SQL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Calculation" child
    JOIN "Calculation" parent ON parent."id" = child."recalculatesId"
    WHERE child."organizationId" <> parent."organizationId"
  ) THEN
    RAISE EXCEPTION 'Cross-organization calculation revisions already exist';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "taxman_enforce_calculation_revision_tenant"()
RETURNS trigger AS $$
BEGIN
  IF NEW."recalculatesId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "Calculation" parent
    WHERE parent."id" = NEW."recalculatesId"
      AND parent."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'Calculation revision source must belong to the same organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Calculation_revision_tenant_guard"
BEFORE INSERT ON "Calculation"
FOR EACH ROW EXECUTE FUNCTION "taxman_enforce_calculation_revision_tenant"();
