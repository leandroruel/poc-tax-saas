import { describe, expect, it } from "vitest";
import { InvalidCsvError, parseCsv } from "./csv.js";

describe("parseCsv", () => {
  it("detects semicolons and preserves delimiters and escaped quotes inside fields", () => {
    const parsed = parseCsv(
      '\uFEFFdata;valor;descricao\r\n20/08/2026;10.000,50;"Crédito; lote ""A"""',
    );

    expect(parsed.delimiter).toBe(";");
    expect(parsed.headers).toEqual(["data", "valor", "descricao"]);
    expect(parsed.rows).toEqual([
      {
        rowNumber: 2,
        values: {
          data: "20/08/2026",
          valor: "10.000,50",
          descricao: 'Crédito; lote "A"',
        },
      },
    ]);
  });

  it("rejects rows with a different number of columns", () => {
    expect(() => parseCsv("data,valor\n2026-08-20,100,extra")).toThrowError(
      new InvalidCsvError("column_count_mismatch", 2),
    );
  });
});
