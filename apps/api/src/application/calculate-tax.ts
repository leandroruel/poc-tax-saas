import { IofEngine } from "../domain/iof/iof-engine.js";
import type { IofOperation } from "../domain/iof/operation.js";
import {
  selectedRuleIdOf,
  type IofOutcome,
} from "../domain/iof/outcome.js";
import type { TenantContext } from "../domain/tenancy/tenant-context.js";
import type { CalculationJournal } from "./ports/calculation-journal.js";
import type { RuleCatalog } from "./ports/rule-catalog.js";

export interface CalculateTaxCommand {
  actorUserId: string;
  tenant: Pick<TenantContext, "id" | "segment">;
  operation: IofOperation;
  recalculatesId?: string;
}

export interface CalculateTaxResponse {
  calculationId: string;
  outcome: IofOutcome;
}

export type CalculateTax = (
  command: CalculateTaxCommand,
) => Promise<CalculateTaxResponse>;

export function createCalculateTax(dependencies: {
  ruleCatalog: RuleCatalog;
  calculationJournal: CalculationJournal;
}): CalculateTax {
  return async (command) => {
    const rules = await dependencies.ruleCatalog.findApprovedEffective({
      occurredOn: command.operation.occurredOn,
    });
    const outcome = new IofEngine(rules).evaluate({
      tenant: command.tenant,
      operation: command.operation,
    });
    const selectedRuleId = selectedRuleIdOf(outcome);
    const selectedRule = rules.find((rule) => rule.id === selectedRuleId);
    const { calculationId } = await dependencies.calculationJournal.record({
      command,
      outcome,
      selectedRule,
    });
    return { calculationId, outcome };
  };
}
