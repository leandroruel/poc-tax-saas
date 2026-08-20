import type { LocalDate } from "../shared/local-date.js";
import type { RuleEditorialStatus } from "../iof/rule.js";

interface FixedIncomeRuleVersionBase {
  readonly id: string;
  readonly version: number;
  readonly status: RuleEditorialStatus;
  readonly operationType: "fixed_income_redemption";
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo: LocalDate | null;
  readonly legalBasis: string;
  readonly sourceUrl?: string;
  readonly rounding: "half_up_cent";
  readonly holdingPeriod: "elapsed_calendar_days";
}

export interface FixedIncomeIofRuleVersion
  extends FixedIncomeRuleVersionBase {
  readonly taxType: "IOF";
  readonly treatment: {
    readonly kind: "yield_regressive_limit";
    /** Position zero is holding day 1; day 30 must be zero. */
    readonly limitPercentages: readonly string[];
    readonly revenueCode: "6854";
  };
}

export interface FixedIncomeIrrfRuleVersion
  extends FixedIncomeRuleVersionBase {
  readonly taxType: "IRRF";
  readonly treatment: {
    readonly kind: "fixed_income_brackets";
    readonly brackets: readonly {
      readonly throughDays: number | null;
      readonly percentage: string;
    }[];
    readonly revenueCode: "8053";
  };
}

export type FixedIncomeTaxRuleVersion =
  | FixedIncomeIofRuleVersion
  | FixedIncomeIrrfRuleVersion;
