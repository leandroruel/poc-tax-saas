import { Prisma, type PrismaClient } from "@prisma/client";
import { decodeStoredCalculation } from "../../application/codecs/calculation-record-codec.js";
import type { CalculationLedger } from "../../application/ports/calculation-ledger.js";
import type {
  CalculationListFilters,
  CalculationOperationType,
  CalculationRecord,
} from "../../application/read-models/calculation-record.js";
import { businessDateInBrazil } from "../../application/time/business-calendar.js";

const calculationSelect = {
  id: true,
  operationType: true,
  occurredOn: true,
  input: true,
  outcome: true,
  ruleSnapshot: true,
  recalculatesId: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const satisfies Prisma.CalculationSelect;

type CalculationRow = Prisma.CalculationGetPayload<{
  select: typeof calculationSelect;
}>;

function operationTypeOf(
  row: CalculationRow,
  operationKind: "credit" | "vgbl",
): CalculationOperationType {
  const expected =
    operationKind === "vgbl"
      ? "insurance_vgbl"
      : "credit_pj_principal_defined";
  if (row.operationType !== expected) {
    throw new Error(
      `Calculation ${row.id} has inconsistent operation type ${row.operationType}.`,
    );
  }
  return expected;
}

function calculationRecord(row: CalculationRow): CalculationRecord {
  const stored = decodeStoredCalculation({
    operation: row.input,
    outcome: row.outcome,
    ruleSnapshot: row.ruleSnapshot,
  });
  return {
    id: row.id,
    operationType: operationTypeOf(row, stored.operation.kind),
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    input: stored.operation,
    outcome: stored.outcome,
    ruleSnapshot: stored.ruleSnapshot,
    recalculatesId: row.recalculatesId,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
  };
}

function dateAtUtcMidnight(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function decimalMoney(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[2]?.length ?? 0) > 2) {
    throw new Error(`Invalid aggregated monetary amount: ${value}`);
  }
  return `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}`;
}

function whereFor(
  tenantId: string,
  filters: CalculationListFilters,
): Prisma.CalculationWhereInput {
  const and: Prisma.CalculationWhereInput[] = [];
  if (filters.cursor) {
    const createdAt = new Date(filters.cursor.createdAt);
    and.push({
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: filters.cursor.id } },
      ],
    });
  }
  if (filters.calculationId) and.push({ id: filters.calculationId });
  if (filters.operationType) {
    and.push({ operationType: filters.operationType });
  }
  if (filters.status) {
    and.push({ outcome: { path: ["kind"], equals: filters.status } });
  }
  if (filters.occurredFrom || filters.occurredTo) {
    and.push({
      occurredOn: {
        ...(filters.occurredFrom
          ? { gte: dateAtUtcMidnight(filters.occurredFrom) }
          : {}),
        ...(filters.occurredTo
          ? { lte: dateAtUtcMidnight(filters.occurredTo) }
          : {}),
      },
    });
  }
  if (filters.createdThrough) {
    and.push({ createdAt: { lte: new Date(filters.createdThrough) } });
  }
  return { organizationId: tenantId, ...(and.length ? { AND: and } : {}) };
}

export function createPrismaCalculationLedger(
  prisma: PrismaClient,
): CalculationLedger {
  return {
    async overview(tenantId) {
      const today = businessDateInBrazil();
      const [
        totalCalculations,
        recent,
        ruleVersionCount,
        summaryRows,
        activityRows,
      ] = await Promise.all([
        prisma.calculation.count({ where: { organizationId: tenantId } }),
        prisma.calculation.findMany({
          where: { organizationId: tenantId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
          select: calculationSelect,
        }),
        prisma.taxRuleVersion.count({ where: { editorialStatus: "approved" } }),
        prisma.$queryRaw<
          { taxAmount: string; attentionRequired: number }[]
        >(Prisma.sql`
          SELECT
            COALESCE(SUM(
              CASE
                WHEN timezone(
                  'America/Sao_Paulo',
                  "createdAt" AT TIME ZONE 'UTC'
                )::date >= CAST(${today} AS date) - 29
                  AND "outcome" ->> 'kind' = 'calculated'
                THEN ("outcome" #>> '{result,amount}')::numeric
                ELSE 0
              END
            ), 0)::text AS "taxAmount",
            COUNT(*) FILTER (
              WHERE "outcome" ->> 'kind' IN (
                'unsupported',
                'requires_context',
                'no_rule',
                'ambiguous_rule'
              )
            )::int AS "attentionRequired"
          FROM "Calculation"
          WHERE "organizationId" = CAST(${tenantId} AS uuid)
        `),
        prisma.$queryRaw<
          { date: string; calculations: number; taxAmount: string }[]
        >(Prisma.sql`
          WITH days AS (
            SELECT generate_series(
              CAST(${today} AS date) - INTERVAL '13 days',
              CAST(${today} AS date),
              INTERVAL '1 day'
            )::date AS day
          )
          SELECT
            days.day::text AS "date",
            COUNT(calculation.id)::int AS "calculations",
            COALESCE(SUM(
              CASE
                WHEN calculation.outcome ->> 'kind' = 'calculated'
                THEN (calculation.outcome #>> '{result,amount}')::numeric
                ELSE 0
              END
            ), 0)::text AS "taxAmount"
          FROM days
          LEFT JOIN "Calculation" calculation
            ON calculation."organizationId" = CAST(${tenantId} AS uuid)
            AND timezone(
              'America/Sao_Paulo',
              calculation."createdAt" AT TIME ZONE 'UTC'
            )::date = days.day
          GROUP BY days.day
          ORDER BY days.day ASC
        `),
      ]);
      const summary = summaryRows[0] ?? {
        taxAmount: "0",
        attentionRequired: 0,
      };
      return {
        totalCalculations,
        ruleVersionCount,
        calculatedTaxAmount30Days: decimalMoney(summary.taxAmount),
        attentionRequired: summary.attentionRequired,
        activity: activityRows.map((row) => ({
          ...row,
          taxAmount: decimalMoney(row.taxAmount),
        })),
        recentCalculations: recent.map(calculationRecord),
      };
    },
    async list(tenantId, filters) {
      const rows = await prisma.calculation.findMany({
        where: whereFor(tenantId, filters),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: filters.limit + 1,
        select: calculationSelect,
      });
      const hasNextPage = rows.length > filters.limit;
      const items = rows.slice(0, filters.limit).map(calculationRecord);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          hasNextPage && last
            ? { createdAt: last.createdAt, id: last.id }
            : null,
      };
    },
    async get(tenantId, calculationId) {
      const row = await prisma.calculation.findFirst({
        where: { id: calculationId, organizationId: tenantId },
        select: calculationSelect,
      });
      return row ? calculationRecord(row) : null;
    },
  };
}
