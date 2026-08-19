import { describe, expect, it } from "vitest";
import { reais } from "../domain/money.js";
import type { TaxRule } from "../domain/tax-rule.js";
import { createCalculateTax } from "./calculate-tax.js";

const rule: TaxRule = {
  id: "fx-inflow",
  taxType: "IOF",
  operationType: "foreign_exchange_inflow",
  effectiveFrom: "2025-06-11",
  effectiveTo: null,
  version: 1,
  rate: { percentage: "0.38", unit: "percent" },
  basePolicy: { kind: "full_amount" },
  conditions: [],
  legalBasis: "Decreto 6.306/2007, art. 15-B, XXV",
  status: "in_force",
};

describe("calculateTax", () => {
  it("devolve o identificador da tentativa auditada junto com o cálculo", async () => {
    const calculateTax = createCalculateTax({
      ruleCatalog: {
        findEffective: async () => [rule],
      },
      calculationJournal: {
        record: async () => ({ calculationId: "calculation-1" }),
      },
    });

    const response = await calculateTax({
      tenantId: "tenant-1",
      taxType: "IOF",
      asOf: "2025-07-01",
      operation: {
        kind: "foreign_exchange",
        occurredOn: "2025-07-01",
        amount: reais("1000.00"),
        direction: "inflow",
      },
    });

    expect(response).toMatchObject({
      calculationId: "calculation-1",
      outcome: {
        kind: "calculated",
        result: { amount: reais("3.80"), ruleId: "fx-inflow" },
      },
    });
  });
});
