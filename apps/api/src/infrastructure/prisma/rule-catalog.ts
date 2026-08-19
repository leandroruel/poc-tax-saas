import type { TaxRule as TaxRuleRow } from "@prisma/client";
import { z } from "zod";
import type { RuleCatalog } from "../../application/ports/rule-catalog.js";
import { reais } from "../../domain/money.js";
import type { LocalDate } from "../../domain/operation.js";
import type {
  RateUnit,
  RuleCondition,
  TaxBasePolicy,
  TaxRule,
} from "../../domain/tax-rule.js";
import type { PrismaClient } from "@prisma/client";

const operationTypeSchema = z.enum([
  "credit_pj",
  "credit_simples_mei",
  "insurance_vgbl",
  "foreign_exchange_outflow",
  "foreign_exchange_inflow",
  "foreign_exchange_investment",
  "investment_fidc",
]);

const conditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("maximum_amount"), amount: z.string() }),
  z.object({
    kind: z.literal("person_type_is"),
    role: z.enum(["insured", "borrower"]),
    value: z.enum(["PF", "PJ"]),
  }),
  z.object({ kind: z.literal("payer_is"), value: z.literal("policyholder") }),
  z.object({ kind: z.literal("market_is"), value: z.literal("primary") }),
]);

const basePolicySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("full_amount") }),
  z.object({
    kind: z.literal("aggregate_threshold"),
    scope: z.enum(["same_insurer", "all_insurers"]),
    threshold: z.string(),
  }),
]);

function localDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

function rateUnit(value: string): RateUnit {
  if (value === "percent" || value === "daily_percent") return value;
  throw new Error(`Invalid rate unit stored in TaxRule: ${value}`);
}

function conditionsFromJson(value: unknown): readonly RuleCondition[] {
  return z.array(conditionSchema).parse(value).map((condition) =>
    condition.kind === "maximum_amount"
      ? { ...condition, amount: reais(condition.amount) }
      : condition
  );
}

function basePolicyFromJson(value: unknown): TaxBasePolicy {
  const policy = basePolicySchema.parse(value);
  return policy.kind === "aggregate_threshold"
    ? { ...policy, threshold: reais(policy.threshold) }
    : policy;
}

export function mapRule(row: TaxRuleRow): TaxRule {
  if (row.taxType !== "IOF") throw new Error(`Unsupported tax type stored in TaxRule: ${row.taxType}`);

  return {
    id: row.id,
    taxType: row.taxType,
    operationType: operationTypeSchema.parse(row.operationType),
    effectiveFrom: localDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? localDate(row.effectiveTo) : null,
    version: row.version,
    rate: { percentage: row.rate.toString(), unit: rateUnit(row.rateUnit) },
    additionalRate:
      row.additionalRate && row.additionalRateUnit
        ? {
            percentage: row.additionalRate.toString(),
            unit: rateUnit(row.additionalRateUnit),
          }
        : undefined,
    basePolicy: basePolicyFromJson(row.basePolicy),
    conditions: conditionsFromJson(row.conditions),
    legalBasis: row.legalBasis,
    status: row.status,
  };
}

function atStartOfDay(date: LocalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function createPrismaRuleCatalog(prisma: PrismaClient): RuleCatalog {
  return {
    async findEffective({ taxType, asOf }) {
      const instant = atStartOfDay(asOf);
      const rows = await prisma.taxRule.findMany({
        where: {
          taxType,
          effectiveFrom: { lte: instant },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
        },
        orderBy: [{ version: "desc" }, { operationType: "asc" }],
      });
      return rows.map(mapRule);
    },
  };
}
