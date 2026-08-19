import { Prisma, type PrismaClient } from "@prisma/client";
import type { CalculationJournal } from "../../application/ports/calculation-journal.js";
import type { TaxOutcome } from "../../domain/calculation.js";
import { moneyToDecimal, type Money } from "../../domain/money.js";

type JsonValue = Prisma.InputJsonValue | null;

function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") return moneyToDecimal(value as Money);
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    return jsonObject(value);
  }
  throw new Error(`Unsupported audit JSON value: ${typeof value}`);
}

function jsonObject(value: object): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, jsonValue(nested)])
  ) as Prisma.InputJsonObject;
}

function classifiedType(outcome: TaxOutcome): string | null {
  return outcome.kind === "calculated" || outcome.kind === "calculated_with_warning"
    ? outcome.result.operationType
    : null;
}

export function createPrismaCalculationJournal(prisma: PrismaClient): CalculationJournal {
  return {
    async record({ command, outcome }) {
      return prisma.$transaction(async (transaction) => {
        const operation = await transaction.operation.create({
          data: {
            tenantId: command.tenantId,
            payload: jsonObject(command.operation),
            classifiedType: classifiedType(outcome),
          },
        });
        const calculation = await transaction.calculation.create({
          data: {
            operationId: operation.id,
            asOfDate: new Date(`${command.asOf}T00:00:00.000Z`),
            outcome: jsonObject(outcome),
          },
        });
        return { calculationId: calculation.id };
      });
    },
  };
}
