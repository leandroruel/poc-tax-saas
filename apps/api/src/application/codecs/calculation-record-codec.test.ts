import { describe, expect, it } from "vitest";
import { decodeStoredCalculation } from "./calculation-record-codec.js";

const operation = {
  kind: "credit",
  modality: "principal_defined",
  occurredOn: "2025-06-10",
  amount: "10000.00",
  borrower: { personType: "PJ" },
  termInDays: 30,
};

const ruleSnapshot = {
  id: "credit-v1",
  version: 1,
  status: "approved",
  operationType: "credit_pj_principal_defined",
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  treatment: {
    kind: "rate",
    rate: { percentage: "0.0041", unit: "daily_percent" },
    additionalRate: { percentage: "0.38", unit: "percent" },
    basePolicy: { kind: "full_amount" },
  },
  legalBasis: "Decreto 6.306/2007, art. 7º",
};

describe("stored calculation codec", () => {
  it("decodes the typed ledger payload", () => {
    const decoded = decodeStoredCalculation({
      operation,
      ruleSnapshot,
      outcome: {
        kind: "calculated",
        result: {
          amount: "50.30",
          taxableBase: "10000.00",
          grossBase: "10000.00",
          ruleId: "credit-v1",
          ruleVersion: 1,
          operationType: "credit_pj_principal_defined",
          effectivePeriod: { from: "2025-01-01", to: null },
          rate: { percentage: "0.0041", unit: "daily_percent" },
          additionalRate: { percentage: "0.38", unit: "percent" },
          legalBasis: "Decreto 6.306/2007, art. 7º",
          evidence: ["base integral"],
        },
      },
    });

    expect(decoded.operation).toEqual(operation);
    expect(decoded.ruleSnapshot).toEqual(ruleSnapshot);
    expect(decoded.outcome.kind).toBe("calculated");
  });

  it("rejects malformed persisted money instead of leaking unknown JSON", () => {
    expect(() =>
      decodeStoredCalculation({
        operation: { ...operation, amount: "10,000.00" },
        outcome: { kind: "no_rule", operationType: "credit_pj_principal_defined" },
        ruleSnapshot: null,
      }),
    ).toThrow();
  });
});
