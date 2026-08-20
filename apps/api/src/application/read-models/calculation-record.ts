import type { SerializedIofOperation, SerializedIofOutcome, SerializedIofRuleVersion } from "../codecs/calculation-record-codec.js";

export const calculationStatuses = [
  "calculated",
  "unsupported",
  "not_applicable",
  "requires_context",
  "no_rule",
  "ambiguous_rule",
] as const;

export type CalculationStatus = (typeof calculationStatuses)[number];

export const calculationOperationTypes = [
  "credit_pj_principal_defined",
  "insurance_vgbl",
] as const;

export type CalculationOperationType =
  (typeof calculationOperationTypes)[number];

export interface CalculationRecord {
  readonly id: string;
  readonly operationType: CalculationOperationType;
  readonly occurredOn: string;
  readonly input: SerializedIofOperation;
  readonly outcome: SerializedIofOutcome;
  readonly ruleSnapshot: SerializedIofRuleVersion | null;
  readonly recalculatesId: string | null;
  readonly createdAt: string;
  readonly createdBy: { readonly id: string; readonly name: string };
}

export interface CalculationCursor {
  readonly createdAt: string;
  readonly id: string;
}

export interface CalculationListFilters {
  readonly limit: number;
  readonly cursor?: CalculationCursor;
  readonly calculationId?: string;
  readonly operationType?: CalculationOperationType;
  readonly status?: CalculationStatus;
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
  /** Inclusive UTC boundary used to keep asynchronous exports reproducible. */
  readonly createdThrough?: string;
}

export interface CalculationPage {
  readonly items: readonly CalculationRecord[];
  readonly nextCursor: CalculationCursor | null;
}

export interface CalculationOverview {
  readonly totalCalculations: number;
  readonly ruleVersionCount: number;
  readonly calculatedTaxAmount30Days: string;
  readonly attentionRequired: number;
  readonly activity: readonly {
    readonly date: string;
    readonly calculations: number;
    readonly taxAmount: string;
  }[];
  readonly recentCalculations: readonly CalculationRecord[];
}
