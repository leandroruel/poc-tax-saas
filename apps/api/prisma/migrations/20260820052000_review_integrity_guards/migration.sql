-- Prevent concurrent approvals from creating more than one effective rule for
-- the same legal period. The range is half-open: [effectiveFrom, effectiveTo).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "TaxRuleVersion"
ADD CONSTRAINT "TaxRuleVersion_approved_period_excl"
EXCLUDE USING GIST (
  "ruleId" WITH =,
  daterange("effectiveFrom", "effectiveTo", '[)') WITH &&
)
WHERE ("editorialStatus" = 'approved'::"RuleEditorialStatus");

-- The activation observer may run in multiple API replicas. Only one audit
-- edge is allowed for a rule version, even when observers race.
CREATE UNIQUE INDEX "AuditLog_rule_activation_unique"
ON "AuditLog" ("entityType", "entityId")
WHERE "action" = 'rule_version.became_active';

-- Row-level UPDATE/DELETE triggers do not cover TRUNCATE.
CREATE TRIGGER "Calculation_prevent_truncate"
BEFORE TRUNCATE ON "Calculation"
FOR EACH STATEMENT EXECUTE FUNCTION taxman_prevent_append_only_mutation();

CREATE TRIGGER "AuditLog_prevent_truncate"
BEFORE TRUNCATE ON "AuditLog"
FOR EACH STATEMENT EXECUTE FUNCTION taxman_prevent_append_only_mutation();
