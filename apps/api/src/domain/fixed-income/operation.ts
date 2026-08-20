import type { LocalDate } from "../shared/local-date.js";
import type { Money } from "../shared/money.js";

export interface FixedIncomeRedemption {
  readonly kind: "fixed_income_redemption";
  readonly instrument: "CDB" | "RDB";
  readonly taxTreatment: "taxable_general_rule";
  readonly investedAt: LocalDate;
  readonly redeemedAt: LocalDate;
  readonly principalAmount: Money;
  readonly grossRedemptionAmount: Money;
  readonly beneficiary: {
    readonly personType: "PF";
    readonly residency: "BR";
  };
  readonly redemptionKind: "full" | "maturity";
  readonly hasPeriodicIncome: false;
}
