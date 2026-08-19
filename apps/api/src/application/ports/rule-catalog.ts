import type { LocalDate } from "../../domain/operation.js";
import type { TaxRule } from "../../domain/tax-rule.js";

export interface RuleCatalog {
  findEffective(query: {
    taxType: "IOF";
    asOf: LocalDate;
  }): Promise<readonly TaxRule[]>;
}
