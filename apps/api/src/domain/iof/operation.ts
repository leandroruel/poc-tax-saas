import type { Money } from "../shared/money.js";

export type LocalDate = string;

export function isLocalDate(value: string): value is LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

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
