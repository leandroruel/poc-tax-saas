import type { LocalDate } from "../../domain/iof/operation.js";
import type { IofRuleVersion } from "../../domain/iof/rule.js";

export interface RuleCatalog {
  findApprovedEffective(query: {
    occurredOn: LocalDate;
  }): Promise<readonly IofRuleVersion[]>;
}
