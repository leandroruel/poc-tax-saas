import { z } from "zod";
import { serializedTaxTreatmentSchema } from "./tax-treatment-codec.js";

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moneySchema = z.string().regex(/^\d+\.\d{2}$/);
const rateSchema = z
  .object({
    percentage: z.string().regex(/^\d+(?:\.\d+)?$/),
    unit: z.enum(["percent", "daily_percent"]),
  })
  .strict();

export const serializedIofOperationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("credit"),
      modality: z.literal("principal_defined"),
      occurredOn: localDateSchema,
      amount: moneySchema,
      borrower: z.object({ personType: z.literal("PJ") }).strict(),
      termInDays: z.number().int().positive().safe(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("vgbl"),
      occurredOn: localDateSchema,
      amount: moneySchema,
      insured: z.object({ personType: z.literal("PF") }).strict(),
      payer: z.enum(["policyholder", "employer"]),
      priorContributions: z
        .object({
          sameInsurer: moneySchema.optional(),
          allInsurers: moneySchema.optional(),
        })
        .strict(),
    })
    .strict(),
]);

const operationTypeSchema = z.enum([
  "credit_pj_principal_defined",
  "insurance_vgbl",
]);

const resultSchema = z
  .object({
    amount: moneySchema,
    taxableBase: moneySchema,
    grossBase: moneySchema,
    ruleId: z.string(),
    ruleVersion: z.number().int().positive(),
    operationType: operationTypeSchema,
    effectivePeriod: z
      .object({ from: localDateSchema, to: localDateSchema.nullable() })
      .strict(),
    rate: rateSchema,
    additionalRate: rateSchema.optional(),
    legalBasis: z.string(),
    evidence: z.array(z.string()).readonly(),
  })
  .strict();

export const serializedIofOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("calculated"), result: resultSchema }).strict(),
  z
    .object({
      kind: z.literal("unsupported"),
      reason: z.literal("segment_capability_mismatch"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("not_applicable"),
      ruleId: z.string(),
      reason: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("requires_context"),
      missing: z.array(z.string()).readonly(),
    })
    .strict(),
  z
    .object({ kind: z.literal("no_rule"), operationType: operationTypeSchema })
    .strict(),
  z
    .object({
      kind: z.literal("ambiguous_rule"),
      ruleIds: z.array(z.string()).readonly(),
    })
    .strict(),
]);

export const serializedIofRuleVersionSchema = z
  .object({
    id: z.string(),
    version: z.number().int().positive(),
    status: z.enum([
      "draft",
      "pending_review",
      "approved",
      "rejected",
      "revoked",
    ]),
    operationType: operationTypeSchema,
    effectiveFrom: localDateSchema,
    effectiveTo: localDateSchema.nullable(),
    treatment: serializedTaxTreatmentSchema,
    legalBasis: z.string(),
    sourceUrl: z.string().optional(),
  })
  .strict();

export type SerializedIofOperation = z.infer<
  typeof serializedIofOperationSchema
>;
export type SerializedIofOutcome = z.infer<typeof serializedIofOutcomeSchema>;
export type SerializedIofRuleVersion = z.infer<
  typeof serializedIofRuleVersionSchema
>;

export function decodeStoredCalculation(input: {
  operation: unknown;
  outcome: unknown;
  ruleSnapshot: unknown;
}): {
  operation: SerializedIofOperation;
  outcome: SerializedIofOutcome;
  ruleSnapshot: SerializedIofRuleVersion | null;
} {
  return {
    operation: serializedIofOperationSchema.parse(input.operation),
    outcome: serializedIofOutcomeSchema.parse(input.outcome),
    ruleSnapshot:
      input.ruleSnapshot === null
        ? null
        : serializedIofRuleVersionSchema.parse(input.ruleSnapshot),
  };
}
