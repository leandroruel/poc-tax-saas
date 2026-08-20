import { z } from "zod";
import type { TaxTreatment } from "../../domain/iof/rule.js";
import { reais } from "../../domain/shared/money.js";

const rateSchema = z
  .object({
    percentage: z.string().regex(/^\d+(?:\.\d+)?$/),
    unit: z.enum(["percent", "daily_percent"]),
  })
  .strict();

export const serializedTaxTreatmentSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("not_applicable"),
      reason: z.string().min(3).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("rate"),
      rate: rateSchema,
      additionalRate: rateSchema.optional(),
      basePolicy: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("full_amount") }).strict(),
        z
          .object({
            kind: z.literal("aggregate_threshold"),
            scope: z.enum(["same_insurer", "all_insurers"]),
            threshold: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
          })
          .strict(),
      ]),
    })
    .strict(),
]);

export type SerializedTaxTreatment = z.infer<
  typeof serializedTaxTreatmentSchema
>;

export function toDomainTaxTreatment(
  value: SerializedTaxTreatment,
): TaxTreatment {
  if (value.kind === "not_applicable") return value;
  if (value.basePolicy.kind === "full_amount") {
    return { ...value, basePolicy: { kind: "full_amount" } };
  }
  return {
    ...value,
    basePolicy: {
      ...value.basePolicy,
      threshold: reais(value.basePolicy.threshold),
    },
  };
}
