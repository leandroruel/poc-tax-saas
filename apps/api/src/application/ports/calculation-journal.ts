import type { TaxOutcome } from "../../domain/calculation.js";
import type { CalculateTaxCommand } from "../calculate-tax.js";

export interface CalculationJournal {
  record(entry: {
    command: CalculateTaxCommand;
    outcome: TaxOutcome;
  }): Promise<{ calculationId: string }>;
}
