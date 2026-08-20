CREATE OR REPLACE FUNCTION "taxman_prevent_append_only_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Calculation_append_only"
BEFORE UPDATE OR DELETE ON "Calculation"
FOR EACH ROW EXECUTE FUNCTION "taxman_prevent_append_only_mutation"();

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION "taxman_prevent_append_only_mutation"();
