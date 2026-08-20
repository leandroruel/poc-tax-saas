import { describe, expect, it } from "vitest";
import { InvalidCnpjError, parseCnpj } from "./cnpj.js";

describe("CNPJ", () => {
  it("normalizes the current numeric format", () => {
    expect(parseCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });

  it("rejects repeated numeric identifiers even when check digits match", () => {
    expect(() => parseCnpj("00.000.000/0000-00")).toThrow(InvalidCnpjError);
  });
});
