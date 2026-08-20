import { describe, expect, it } from "vitest";
import { decodeImportedOperation } from "./imported-operation.js";

describe("decodeImportedOperation", () => {
  it("restores money persisted as decimal strings", () => {
    expect(
      decodeImportedOperation({
        kind: "credit",
        modality: "principal_defined",
        occurredOn: "2026-08-20",
        amount: "1000.50",
        borrower: { personType: "PJ" },
        termInDays: 30,
      }),
    ).toMatchObject({ amount: 100_050n, termInDays: 30 });
  });

  it("fails closed for malformed persisted input", () => {
    expect(() =>
      decodeImportedOperation({ kind: "credit", amount: "1000.00" }),
    ).toThrow("Invalid imported operation fields");
  });
});
