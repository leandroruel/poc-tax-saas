import { describe, expect, it } from "vitest";
import { mapImportedRow, missingMappedColumns } from "./import-mapping.js";

const creditMapping = {
  operationType: "credit_pj_principal_defined",
  dateFormat: "dd/mm/yyyy",
  numberFormat: "decimal_comma",
  columns: {
    occurredOn: "data",
    amount: "valor",
    termInDays: "prazo",
  },
} as const;

describe("import mapping", () => {
  it("normalizes a Brazilian credit row into the existing IOF operation", () => {
    const result = mapImportedRow(
      { data: "20/08/2026", valor: "10.000,50", prazo: "30" },
      creditMapping,
    );

    expect(result).toEqual({
      ok: true,
      operation: {
        kind: "credit",
        modality: "principal_defined",
        occurredOn: "2026-08-20",
        amount: 1_000_050n,
        borrower: { personType: "PJ" },
        termInDays: 30,
      },
    });
  });

  it("collects readable validation failures without approximating values", () => {
    const result = mapImportedRow(
      { data: "31/02/2026", valor: "10,009", prazo: "0" },
      creditMapping,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toEqual([
        "invalid_date",
        "invalid_money",
        "invalid_integer",
      ]);
    }
  });

  it("reports configured columns missing from the uploaded header", () => {
    expect(missingMappedColumns(["data", "valor"], creditMapping)).toEqual([
      "prazo",
    ]);
  });
});
