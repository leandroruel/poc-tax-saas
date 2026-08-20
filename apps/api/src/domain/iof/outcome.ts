import type { Money } from "../shared/money.js";
import type { LocalDate } from "./operation.js";
import type { IofOperationType, TaxRate } from "./rule.js";

export interface IofResult {
  amount: Money;
  taxableBase: Money;
  grossBase: Money;
  ruleId: string;
  ruleVersion: number;
  operationType: IofOperationType;
  effectivePeriod: { from: LocalDate; to: LocalDate | null };
  rate: TaxRate;
  additionalRate?: TaxRate;
  legalBasis: string;
  evidence: readonly string[];
}

export type IofOutcome =
  | { kind: "calculated"; result: IofResult }
  | { kind: "unsupported"; reason: "segment_capability_mismatch" }
  | { kind: "not_applicable"; ruleId: string; reason: string }
  | { kind: "requires_context"; missing: readonly string[] }
  | { kind: "no_rule"; operationType: IofOperationType }
  | { kind: "ambiguous_rule"; ruleIds: readonly string[] };

export function selectedRuleIdOf(outcome: IofOutcome): string | undefined {
  if (outcome.kind === "calculated") return outcome.result.ruleId;
  if (outcome.kind === "not_applicable") return outcome.ruleId;
  return undefined;
}
