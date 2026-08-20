import type { Money } from "../shared/money.js";
import type { LocalDate } from "../shared/local-date.js";
export { isLocalDate, type LocalDate } from "../shared/local-date.js";

export interface CreditOperation {
  kind: "credit";
  modality: "principal_defined";
  occurredOn: LocalDate;
  amount: Money;
  borrower: { personType: "PJ" };
  termInDays: number;
}

export interface VgblOperation {
  kind: "vgbl";
  occurredOn: LocalDate;
  amount: Money;
  insured: { personType: "PF" };
  payer: "policyholder" | "employer";
  priorContributions: {
    sameInsurer?: Money;
    allInsurers?: Money;
  };
}

export type IofOperation = CreditOperation | VgblOperation;

export function assertValidIofOperation(operation: IofOperation): void {
  if (
    operation.kind === "credit" &&
    (!Number.isSafeInteger(operation.termInDays) || operation.termInDays <= 0)
  ) {
    throw new RangeError("Credit term must be a positive safe integer.");
  }
}
