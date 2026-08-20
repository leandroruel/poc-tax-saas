import { describe, expect, it } from "vitest";
import type { CalculationRecord } from "../read-models/calculation-record.js";
import {
  renderCalculationCsv,
  renderCalculationEvidence,
} from "./calculation-export.js";

const record: CalculationRecord = {
  id: "calc-01",
  operationType: "credit_pj_principal_defined",
  occurredOn: "2026-08-20",
  outcome: {
    kind: "calculated",
    result: {
      amount: "82.00",
      taxableBase: "10000.00",
      grossBase: "10000.00",
      ruleId: "rule-01",
      ruleVersion: 2,
      operationType: "credit_pj_principal_defined",
      legalBasis: "=HYPERLINK(\"unsafe\")",
    },
  },
  recalculatesId: null,
  createdAt: "2026-08-20T12:00:00.000Z",
  createdBy: { id: "user-01", name: "Operador" },
};

describe("calculation CSV export", () => {
  it("renders selected columns with an Excel-friendly BOM", () => {
    const csv = renderCalculationCsv({
      records: [record],
      columns: ["calculationId", "taxAmount"],
      delimiter: ";",
    });
    expect(csv).toBe("\uFEFFID do cálculo;Valor do tributo\r\ncalc-01;82.00\r\n");
  });

  it("neutralizes spreadsheet formulas in exported text", () => {
    const csv = renderCalculationCsv({
      records: [record],
      columns: ["legalBasis"],
      delimiter: ",",
    });
    expect(csv).toContain('"\'=HYPERLINK(""unsafe"")"');
  });

  it("renders a timestamped, versioned evidence document", () => {
    const json = renderCalculationEvidence({
      records: [record],
      generatedAt: "2026-08-20T12:30:00.000Z",
    });
    expect(JSON.parse(json)).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-08-20T12:30:00.000Z",
      records: [{ id: "calc-01" }],
    });
  });
});
