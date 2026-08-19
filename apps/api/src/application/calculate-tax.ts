import type { TaxOutcome } from "../domain/calculation.js";
import { evaluateTax } from "../domain/tax-engine.js";
import type { LocalDate, TaxOperation } from "../domain/operation.js";
import type { CalculationJournal } from "./ports/calculation-journal.js";
import type { RuleCatalog } from "./ports/rule-catalog.js";

export interface CalculateTaxCommand {
  tenantId: string;
  taxType: "IOF";
  asOf: LocalDate;
  operation: TaxOperation;
}

export interface CalculateTaxResponse {
  calculationId: string;
  outcome: TaxOutcome;
}

export type CalculateTax = (command: CalculateTaxCommand) => Promise<CalculateTaxResponse>;

export function createCalculateTax(dependencies: {
  ruleCatalog: RuleCatalog;
  calculationJournal: CalculationJournal;
}): CalculateTax {
  return async (command) => {
    const rules = await dependencies.ruleCatalog.findEffective({
      taxType: command.taxType,
      asOf: command.asOf,
    });
    const outcome = evaluateTax({ ...command, rules });
    const { calculationId } = await dependencies.calculationJournal.record({ command, outcome });
    return { calculationId, outcome };
  };
}
