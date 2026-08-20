import { describe, expect, it } from "vitest";
import { moneyToDecimal, reais } from "./money.js";
import { applyPercentage } from "./percentage.js";

describe("applyPercentage", () => {
  it("uses integer arithmetic and rounds half-up to cents", () => {
    expect(moneyToDecimal(applyPercentage(reais("10.05"), "17.5"))).toBe(
      "1.76",
    );
  });

  it("supports the daily multiplier used by IOF credit", () => {
    expect(moneyToDecimal(applyPercentage(reais("10000"), "0.0082", 30))).toBe(
      "24.60",
    );
  });

  it("rejects malformed percentages and multipliers", () => {
    expect(() => applyPercentage(reais("10"), "-1")).toThrow(
      "Invalid percentage",
    );
    expect(() => applyPercentage(reais("10"), "1", -1)).toThrow(
      "non-negative safe integer",
    );
  });
});
