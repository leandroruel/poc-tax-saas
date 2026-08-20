import type { IofOutcome } from "../../domain/iof/outcome.js";
import type { IofRuleVersion } from "../../domain/iof/rule.js";
import type { CalculateTaxCommand } from "../calculate-tax.js";

export interface CalculationJournal {
  record(entry: {
    command: CalculateTaxCommand;
    outcome: IofOutcome;
    selectedRule?: IofRuleVersion;
  }): Promise<{ calculationId: string }>;
}
