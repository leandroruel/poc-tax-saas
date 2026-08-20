import type { PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { CalculationJournal } from "../../application/ports/calculation-journal.js";
import type { IofOperation } from "../../domain/iof/operation.js";
import { selectedRuleIdOf } from "../../domain/iof/outcome.js";
import { jsonObject } from "./json.js";

function operationType(operation: IofOperation): string {
  return operation.kind === "credit"
    ? "credit_pj_principal_defined"
    : "insurance_vgbl";
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
            ruleVersionId: selectedRuleIdOf(outcome),
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
