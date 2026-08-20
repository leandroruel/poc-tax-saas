import { Prisma, type PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { CalculationJournal } from "../../application/ports/calculation-journal.js";
import type { IofOperation } from "../../domain/iof/operation.js";
import type { IofOutcome } from "../../domain/iof/outcome.js";
import { moneyToDecimal, type Money } from "../../domain/shared/money.js";

type JsonValue = Prisma.InputJsonValue | null;

function jsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return moneyToDecimal(value as Money);
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") return jsonObject(value);
  throw new Error(`Unsupported audit JSON value: ${typeof value}`);
}

function jsonObject(value: object): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, jsonValue(nested)]),
  ) as Prisma.InputJsonObject;
}

function operationType(operation: IofOperation): string {
  return operation.kind === "credit"
    ? "credit_pj_principal_defined"
    : "insurance_vgbl";
}

function selectedRuleId(outcome: IofOutcome): string | undefined {
  if (outcome.kind === "calculated") return outcome.result.ruleId;
  if (outcome.kind === "not_applicable") return outcome.ruleId;
  return undefined;
}

export function createPrismaCalculationJournal(
  prisma: PrismaClient,
): CalculationJournal {
  return {
    async record({ command, outcome, selectedRule }) {
      return prisma.$transaction(async (transaction) => {
        const calculationId = uuidv7();
        await transaction.calculation.create({
          data: {
            id: calculationId,
            organizationId: command.tenant.id,
            createdById: command.actorUserId,
            operationType: operationType(command.operation),
            occurredOn: new Date(
              `${command.operation.occurredOn}T00:00:00.000Z`,
            ),
            input: jsonObject(command.operation),
            outcome: jsonObject(outcome),
            ruleVersionId: selectedRuleId(outcome),
            ruleSnapshot: selectedRule ? jsonObject(selectedRule) : undefined,
            recalculatesId: command.recalculatesId,
          },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: command.actorUserId,
            organizationId: command.tenant.id,
            action: "calculation.created",
            entityType: "Calculation",
            entityId: calculationId,
            after: jsonObject({ operation: command.operation, outcome }),
          },
        });
        return { calculationId };
      });
    },
  };
}
