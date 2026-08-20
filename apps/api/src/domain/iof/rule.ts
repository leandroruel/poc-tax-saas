import type { Money } from "../shared/money.js";
import type { LocalDate } from "./operation.js";

export type IofOperationType = "credit_pj_principal_defined" | "insurance_vgbl";
export type RuleEditorialStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "revoked";

export interface TaxRate {
  percentage: string;
  unit: "percent" | "daily_percent";
}

export type TaxTreatment =
  | {
      kind: "rate";
      rate: TaxRate;
      additionalRate?: TaxRate;
      basePolicy:
        | { kind: "full_amount" }
        | {
            kind: "aggregate_threshold";
            scope: "same_insurer" | "all_insurers";
            threshold: Money;
          };
    }
  | { kind: "not_applicable"; reason: string };

export interface IofRuleVersion {
  id: string;
  version: number;
  status: RuleEditorialStatus;
  operationType: IofOperationType;
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
  treatment: TaxTreatment;
  legalBasis: string;
  sourceUrl?: string;
}
