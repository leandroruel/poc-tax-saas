import { Prisma, type PrismaClient } from "@prisma/client";
import { decodeStoredCalculation } from "../../application/codecs/calculation-record-codec.js";
import type { CalculationLedger } from "../../application/ports/calculation-ledger.js";
import type {
  CalculationListFilters,
  CalculationOperationType,
  CalculationRecord,
} from "../../application/read-models/calculation-record.js";

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
  return { organizationId: tenantId, ...(and.length ? { AND: and } : {}) };
}

export function createPrismaCalculationLedger(
  prisma: PrismaClient,
): CalculationLedger {
  return {
    async overview(tenantId) {
      const [totalCalculations, recent, ruleVersionCount] = await Promise.all([
        prisma.calculation.count({ where: { organizationId: tenantId } }),
        prisma.calculation.findMany({
          where: { organizationId: tenantId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
          select: calculationSelect,
        }),
        prisma.taxRuleVersion.count({ where: { editorialStatus: "approved" } }),
      ]);
      return {
        totalCalculations,
        ruleVersionCount,
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
