import type { Money } from "./money.js";
import type { LocalDate } from "./operation.js";

export type RateUnit = "percent" | "daily_percent";
export type RuleStatus = "in_force" | "contested" | "needs_review";

export type OperationType =
  | "credit_pj"
  | "credit_simples_mei"
  | "insurance_vgbl"
  | "foreign_exchange_outflow"
  | "foreign_exchange_inflow"
  | "foreign_exchange_investment"
  | "investment_fidc";

export interface TaxRate {
  /** Human-readable percentage kept as a decimal string, e.g. "0.00274". */
  percentage: string;
  unit: RateUnit;
}

export type RuleCondition =
  | { kind: "maximum_amount"; amount: Money }
  | { kind: "person_type_is"; role: "insured" | "borrower"; value: "PF" | "PJ" }
  | { kind: "payer_is"; value: "policyholder" }
  | { kind: "market_is"; value: "primary" };

export type TaxBasePolicy =
  | { kind: "full_amount" }
  | {
      kind: "aggregate_threshold";
      scope: "same_insurer" | "all_insurers";
      threshold: Money;
    };

export interface TaxRule {
  id: string;
  taxType: "IOF";
  operationType: OperationType;
  effectiveFrom: LocalDate;
  /** Exclusive upper bound. */
  effectiveTo: LocalDate | null;
  version: number;
  rate: TaxRate;
  additionalRate?: TaxRate;
  basePolicy: TaxBasePolicy;
  conditions: readonly RuleCondition[];
  legalBasis: string;
  status: RuleStatus;
}
