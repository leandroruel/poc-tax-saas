export type PersonType = "PF" | "PJ";

export interface TaxParty {
  personType: PersonType;
  category?: "simples_mei";
}

interface OperationBase {
  date: string;
  baseAmount: number;
}

export type OperationInput =
  | (OperationBase & {
      type: "credit";
      borrower: TaxParty;
      termInDays: number;
      optedIntoSimples: boolean;
    })
  | (OperationBase & {
      type: "insurance";
      product: "vgbl" | "life_survival";
      insured: TaxParty;
      payer: "policyholder" | "employer";
      priorContributions: { sameInsurer?: number; allInsurers?: number };
    })
  | (OperationBase & {
      type: "foreign_exchange";
      direction: "outflow" | "inflow" | "investment";
    })
  | (OperationBase & {
      type: "investment";
      instrument: "fidc";
      market: "primary" | "secondary";
    });

export interface TaxResult {
  taxType: string;
  amount: number;
  taxableBase: number;
  ruleId: string;
  effectivePeriod: { from: string; to: string | null };
  rate: number;
  rateUnit: "percent" | "daily_percent";
  additionalRate?: number;
  additionalRateUnit?: "percent" | "daily_percent";
  base: number;
  legalBasis: string;
  evidence: string[];
}

export interface CalculationExplanation {
  narrative: string;
  evidence: string[];
}

export interface CalculateResponse {
  calculationId: string;
  results: TaxResult[];
  explanation: CalculationExplanation;
  warnings: string[];
  status:
    | "calculated"
    | "calculated_with_warning"
    | "no_rule"
    | "unclassified"
    | "not_applicable"
    | "requires_context"
    | "requires_review"
    | "ambiguous_rule";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export async function fetchCalculate(
  body: { tenantId: string; asOfDate: string; taxType?: string; operation: OperationInput }
): Promise<CalculateResponse> {
  const res = await fetch(`${API_URL}/tax/calculate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok && typeof data?.status !== "string") {
    throw new Error(data?.error ?? "request failed");
  }
  return data as CalculateResponse;
}
