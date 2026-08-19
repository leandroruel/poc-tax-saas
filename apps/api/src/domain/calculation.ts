import type { Money } from "./money.js";
import type { LocalDate } from "./operation.js";
import type { OperationType, RuleStatus, TaxRate } from "./tax-rule.js";

export interface TaxResult {
  taxType: "IOF";
  amount: Money;
  taxableBase: Money;
  grossBase: Money;
  ruleId: string;
  ruleVersion: number;
  operationType: OperationType;
  effectivePeriod: { from: LocalDate; to: LocalDate | null };
  rate: TaxRate;
  additionalRate?: TaxRate;
  legalBasis: string;
  evidence: readonly string[];
}

export type TaxOutcome =
  | { kind: "calculated"; result: TaxResult }
  | { kind: "calculated_with_warning"; result: TaxResult; warnings: readonly string[] }
  | { kind: "unclassified"; reasons: readonly string[] }
  | { kind: "no_rule"; operationTypes: readonly OperationType[] }
  | { kind: "not_applicable"; reasons: readonly string[] }
  | { kind: "requires_context"; missing: readonly string[] }
  | { kind: "requires_review"; ruleId: string; status: RuleStatus }
  | { kind: "ambiguous_rule"; ruleIds: readonly string[] };
