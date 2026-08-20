import type { Money } from "../shared/money.js";
import type {
  FixedIncomeIofRuleVersion,
  FixedIncomeIrrfRuleVersion,
  FixedIncomeTaxRuleVersion,
} from "./rule.js";

interface RuleEvidence {
  readonly amount: Money;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly legalBasis: string;
  readonly revenueCode: string;
}

export interface FixedIncomeSettlementResult {
  readonly operationType: "fixed_income_redemption";
  readonly holdingDays: number;
  readonly principalAmount: Money;
  readonly grossRedemptionAmount: Money;
  readonly grossYield: Money;
  readonly iof: RuleEvidence & {
    readonly taxType: "IOF";
    readonly redemptionBase: Money;
    readonly yieldLimitBase: Money;
    readonly dailyPercentage: "1";
    readonly taxableDays: number;
    readonly limitPercentage: string;
  };
  readonly irrf: RuleEvidence & {
    readonly taxType: "IRRF";
    readonly taxableBase: Money;
    readonly percentage: string;
  };
  readonly netRedemptionAmount: Money;
  readonly evidence: readonly string[];
}

export type FixedIncomeTaxOutcome =
  | { readonly kind: "calculated"; readonly result: FixedIncomeSettlementResult }
  | { readonly kind: "unsupported"; readonly reason: "segment_capability_mismatch" }
  | { readonly kind: "no_rule"; readonly taxType: "IOF" | "IRRF" }
  | {
      readonly kind: "ambiguous_rule";
      readonly taxType: "IOF" | "IRRF";
      readonly ruleIds: readonly string[];
    };

export function selectedFixedIncomeRulesOf(
  outcome: FixedIncomeTaxOutcome,
  rules: readonly FixedIncomeTaxRuleVersion[],
): readonly [FixedIncomeIofRuleVersion, FixedIncomeIrrfRuleVersion] | null {
  if (outcome.kind !== "calculated") return null;
  const iof = rules.find(
    (rule): rule is FixedIncomeIofRuleVersion =>
      rule.taxType === "IOF" && rule.id === outcome.result.iof.ruleId,
  );
  const irrf = rules.find(
    (rule): rule is FixedIncomeIrrfRuleVersion =>
      rule.taxType === "IRRF" && rule.id === outcome.result.irrf.ruleId,
  );
  return iof && irrf ? [iof, irrf] : null;
}
