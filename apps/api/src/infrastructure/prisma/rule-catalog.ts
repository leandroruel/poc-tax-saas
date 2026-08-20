import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  serializedTaxTreatmentSchema,
  toDomainTaxTreatment,
} from "../../application/codecs/tax-treatment-codec.js";
import type { RuleCatalog } from "../../application/ports/rule-catalog.js";
import type { LocalDate } from "../../domain/iof/operation.js";
import type { IofRuleVersion } from "../../domain/iof/rule.js";

const operationTypeSchema = z.enum([
  "credit_pj_principal_defined",
  "insurance_vgbl",
]);

type RuleVersionRow = Prisma.TaxRuleVersionGetPayload<{
  include: { rule: true };
}>;

function localDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function mapRuleVersion(row: RuleVersionRow): IofRuleVersion | null {
  const treatment = serializedTaxTreatmentSchema.safeParse(row.treatment);
  const operationType = operationTypeSchema.safeParse(row.rule.operationType);
  if (!treatment.success || !operationType.success) {
    console.error("invalid_tax_rule_version", {
      ruleVersionId: row.id,
      treatmentError: treatment.error?.issues,
      operationTypeError: operationType.error?.issues,
    });
    return null;
  }
  return {
    id: row.id,
    version: row.version,
    status: row.editorialStatus,
    operationType: operationType.data,
    effectiveFrom: localDate(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? localDate(row.effectiveTo) : null,
    treatment: toDomainTaxTreatment(treatment.data),
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
      return rows.flatMap((row) => {
        const mapped = mapRuleVersion(row);
        return mapped ? [mapped] : [];
      });
    },
  };
}
