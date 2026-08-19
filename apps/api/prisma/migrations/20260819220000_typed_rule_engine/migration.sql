-- Conditions are executable rule predicates; basePolicy controls the taxable base.
ALTER TABLE "TaxRule" RENAME COLUMN "exceptions" TO "conditions";
ALTER TABLE "TaxRule" ADD COLUMN "basePolicy" JSONB;

UPDATE "TaxRule"
SET "basePolicy" = CASE
  WHEN "exemptionThreshold" IS NOT NULL THEN jsonb_build_object(
    'kind', 'aggregate_threshold',
    'scope', CASE WHEN "effectiveFrom" >= DATE '2026-01-01' THEN 'all_insurers' ELSE 'same_insurer' END,
    'threshold', to_char("exemptionThreshold", 'FM999999999999990.00')
  )
  ELSE '{"kind":"full_amount"}'::jsonb
END;

UPDATE "TaxRule"
SET "conditions" = CASE
  WHEN "operationType" = 'insurance_vgbl' THEN
    '[{"kind":"person_type_is","role":"insured","value":"PF"},{"kind":"payer_is","value":"policyholder"}]'::jsonb
  WHEN "operationType" = 'credit_simples_mei' THEN
    '[{"kind":"maximum_amount","amount":"30000.00"}]'::jsonb
  WHEN "operationType" = 'investment_fidc' THEN
    '[{"kind":"market_is","value":"primary"}]'::jsonb
  ELSE '[]'::jsonb
END;

ALTER TABLE "TaxRule" ALTER COLUMN "basePolicy" SET NOT NULL;
ALTER TABLE "TaxRule" DROP COLUMN "exemptionThreshold";

-- Effective intervals use [from, to); remove the one-second gap in the original seed.
UPDATE "TaxRule"
SET "effectiveTo" = TIMESTAMP '2026-01-01 00:00:00'
WHERE "effectiveTo" = TIMESTAMP '2025-12-31 23:59:59';

-- FIDC subscriptions through 13 June 2025 are outside the taxable period.
UPDATE "TaxRule"
SET "effectiveFrom" = TIMESTAMP '2025-06-14 00:00:00'
WHERE "operationType" = 'investment_fidc' AND "effectiveFrom" < TIMESTAMP '2025-06-14 00:00:00';

-- The current compiled decree treats these provisions as effective. Unreviewed
-- drafts remain representable, but seeded legal rules are not silently contested.
UPDATE "TaxRule" SET "status" = 'in_force';

ALTER TABLE "Calculation" RENAME COLUMN "results" TO "outcome";
ALTER TABLE "Calculation" DROP COLUMN "explanation";

CREATE UNIQUE INDEX "TaxRule_taxType_operationType_version_key"
ON "TaxRule"("taxType", "operationType", "version");

ALTER TABLE "TaxRule"
  ADD CONSTRAINT "TaxRule_rate_non_negative" CHECK ("rate" >= 0),
  ADD CONSTRAINT "TaxRule_additional_rate_non_negative" CHECK ("additionalRate" IS NULL OR "additionalRate" >= 0),
  ADD CONSTRAINT "TaxRule_rate_unit_valid" CHECK ("rateUnit" IN ('percent', 'daily_percent')),
  ADD CONSTRAINT "TaxRule_additional_rate_unit_valid" CHECK ("additionalRateUnit" IS NULL OR "additionalRateUnit" IN ('percent', 'daily_percent')),
  ADD CONSTRAINT "TaxRule_additional_rate_complete" CHECK (
    ("additionalRate" IS NULL AND "additionalRateUnit" IS NULL)
    OR ("additionalRate" IS NOT NULL AND "additionalRateUnit" IS NOT NULL)
  ),
  ADD CONSTRAINT "TaxRule_effective_period_valid" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
