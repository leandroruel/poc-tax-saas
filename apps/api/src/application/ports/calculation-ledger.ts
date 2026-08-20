import type {
  CalculationListFilters,
  CalculationOverview,
  CalculationPage,
  CalculationRecord,
} from "../read-models/calculation-record.js";

export interface CalculationLedger {
  overview(tenantId: string): Promise<CalculationOverview>;
  list(
    tenantId: string,
    filters: CalculationListFilters,
  ): Promise<CalculationPage>;
  get(tenantId: string, calculationId: string): Promise<CalculationRecord | null>;
}
