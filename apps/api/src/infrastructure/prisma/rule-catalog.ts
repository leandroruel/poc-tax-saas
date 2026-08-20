import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { RuleCatalog } from "../../application/ports/rule-catalog.js";
import type { LocalDate } from "../../domain/iof/operation.js";
import type { IofRuleVersion, TaxTreatment } from "../../domain/iof/rule.js";
import { reais } from "../../domain/shared/money.js";

const treatmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rate"),
    rate: z.object({
      percentage: z.string(),
      unit: z.enum(["percent", "daily_percent"]),
    }),
    additionalRate: z
      .object({
        percentage: z.string(),
        unit: z.enum(["percent", "daily_percent"]),
      })
      .optional(),
    basePolicy: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("full_amount") }),
      z.object({
        kind: z.literal("aggregate_threshold"),
        scope: z.enum(["same_insurer", "all_insurers"]),
        threshold: z.string(),
      }),
    ]),
  }),
  z.object({ kind: z.literal("not_applicable"), reason: z.string() }),
]);

type RuleVersionRow = Prisma.TaxRuleVersionGetPayload<{
  include: { rule: true };
}>;

function localDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function mapRuleVersion(row: RuleVersionRow): IofRuleVersion {
  const treatment = treatmentSchema.parse(row.treatment);
  const domainTreatment: TaxTreatment =
    treatment.kind === "not_applicable"
      ? treatment
      : treatment.basePolicy.kind === "aggregate_threshold"
        ? {
            ...treatment,
            basePolicy: {
              ...treatment.basePolicy,
              threshold: reais(treatment.basePolicy.threshold),
            },
          }
        : { ...treatment, basePolicy: { kind: "full_amount" } };
  return {
    id: row.id,
    version: row.version,
    status: row.editorialStatus,
    operationType: z
      .enum(["credit_pj_principal_defined", "insurance_vgbl"])
      .parse(row.rule.operationType),
    effectiveFrom: localDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? localDate(row.effectiveTo) : null,
    treatment: domainTreatment,
    legalBasis: row.legalBasis,
    sourceUrl: row.sourceUrl,
  };
}

function atStartOfDay(date: LocalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function createPrismaRuleCatalog(prisma: PrismaClient): RuleCatalog {
  return {
    async findApprovedEffective({ occurredOn }) {
      const instant = atStartOfDay(occurredOn);
      const rows = await prisma.taxRuleVersion.findMany({
        where: {
          editorialStatus: "approved",
          effectiveFrom: { lte: instant },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
        },
        include: { rule: true },
        orderBy: [{ rule: { operationType: "asc" } }, { version: "desc" }],
      });
      return rows.map(mapRuleVersion);
    },
  };
}
