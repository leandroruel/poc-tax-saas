import type { Money } from "./money.js";

export type PersonType = "PF" | "PJ";
export type LocalDate = string;

export interface TaxParty {
  personType: PersonType;
  category?: "simples_mei";
}

interface OperationBase {
  occurredOn: LocalDate;
  amount: Money;
}

export interface CreditOperation extends OperationBase {
  kind: "credit";
  borrower: TaxParty;
  termInDays: number;
  optedIntoSimples: boolean;
}

export interface InsuranceOperation extends OperationBase {
  kind: "insurance";
  product: "vgbl" | "life_survival";
  insured: TaxParty;
  payer: "policyholder" | "employer";
  priorContributions: {
    sameInsurer?: Money;
    allInsurers?: Money;
  };
}

export interface ForeignExchangeOperation extends OperationBase {
  kind: "foreign_exchange";
  direction: "outflow" | "inflow" | "investment";
}

export interface InvestmentOperation extends OperationBase {
  kind: "investment";
  instrument: "fidc";
  market: "primary" | "secondary";
}

export type TaxOperation =
  | CreditOperation
  | InsuranceOperation
  | ForeignExchangeOperation
  | InvestmentOperation;
