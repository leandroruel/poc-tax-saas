import { describe, expect, it } from "vitest";
import { isMoneyNumber, moneyFromNumber, moneyToDecimal } from "./money.js";

describe("Money", () => {
  it("preserves cents affected by floating-point representation", () => {
    expect(isMoneyNumber(0.29)).toBe(true);
    expect(moneyToDecimal(moneyFromNumber(0.29))).toBe("0.29");
  });

  it("rejects fractions smaller than one cent", () => {
    expect(isMoneyNumber(0.291)).toBe(false);
    expect(() => moneyFromNumber(0.291)).toThrow("Invalid BRL amount");
  });
});
