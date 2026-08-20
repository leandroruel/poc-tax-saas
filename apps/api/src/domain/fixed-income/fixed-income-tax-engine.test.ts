import { describe, expect, it } from "vitest";
import { moneyToDecimal, reais } from "../shared/money.js";
import { FixedIncomeTaxEngine } from "./fixed-income-tax-engine.js";
import type { FixedIncomeRedemption } from "./operation.js";
import type {
  FixedIncomeIofRuleVersion,
  FixedIncomeIrrfRuleVersion,
  FixedIncomeTaxRuleVersion,
} from "./rule.js";

const iofLimits = [
  "96", "93", "90", "86", "83", "80", "76", "73", "70", "66",
  "63", "60", "56", "53", "50", "46", "43", "40", "36", "33",
  "30", "26", "23", "20", "16", "13", "10", "6", "3", "0",
] as const;

const iofRule: FixedIncomeIofRuleVersion = {
  id: "iof-fixed-income-v1",
  version: 1,
  status: "approved",
  taxType: "IOF",
  operationType: "fixed_income_redemption",
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  treatment: {
    kind: "yield_regressive_limit",
    limitPercentages: iofLimits,
    revenueCode: "6854",
  },
  legalBasis: "Decreto 6.306/2007, art. 32 e Anexo",
  rounding: "half_up_cent",
  holdingPeriod: "elapsed_calendar_days",
};

const irrfRule: FixedIncomeIrrfRuleVersion = {
  id: "irrf-fixed-income-v1",
  version: 1,
  status: "approved",
  taxType: "IRRF",
  operationType: "fixed_income_redemption",
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  treatment: {
    kind: "fixed_income_brackets",
    brackets: [
      { throughDays: 180, percentage: "22.5" },
      { throughDays: 360, percentage: "20" },
      { throughDays: 720, percentage: "17.5" },
      { throughDays: null, percentage: "15" },
    ],
    revenueCode: "8053",
  },
  legalBasis: "Lei 11.033/2004, art. 1º; IN RFB 1.585/2015, art. 46",
  rounding: "half_up_cent",
  holdingPeriod: "elapsed_calendar_days",
};

function operation(
  overrides: Partial<FixedIncomeRedemption> = {},
): FixedIncomeRedemption {
  return {
    kind: "fixed_income_redemption",
    instrument: "CDB",
    taxTreatment: "taxable_general_rule",
    investedAt: "2026-01-01",
    redeemedAt: "2026-01-11",
    principalAmount: reais("1000"),
    grossRedemptionAmount: reais("1100"),
    beneficiary: { personType: "PF", residency: "BR" },
    redemptionKind: "full",
    hasPeriodicIncome: false,
    ...overrides,
  };
}

function evaluate(
  input: FixedIncomeRedemption,
  rules: readonly FixedIncomeTaxRuleVersion[] = [iofRule, irrfRule],
) {
  return new FixedIncomeTaxEngine(rules).evaluate({
    tenant: { id: "tenant-01", segment: "credit_provider" },
    operation: input,
  });
}

describe("FixedIncomeTaxEngine", () => {
  it("deducts IOF from yield before calculating IRRF", () => {
    const outcome = evaluate(operation());
    expect(outcome.kind).toBe("calculated");
    if (outcome.kind !== "calculated") return;

    expect(outcome.result.holdingDays).toBe(10);
    expect(moneyToDecimal(outcome.result.grossYield)).toBe("100.00");
    expect(outcome.result.iof.limitPercentage).toBe("66");
    expect(moneyToDecimal(outcome.result.iof.amount)).toBe("66.00");
    expect(moneyToDecimal(outcome.result.irrf.taxableBase)).toBe("34.00");
    expect(outcome.result.irrf.percentage).toBe("22.5");
    expect(moneyToDecimal(outcome.result.irrf.amount)).toBe("7.65");
    expect(moneyToDecimal(outcome.result.netRedemptionAmount)).toBe("1026.35");
  });

  it.each([
    [180, "22.5"],
    [181, "20"],
    [360, "20"],
    [361, "17.5"],
    [720, "17.5"],
    [721, "15"],
  ])("selects the IRRF bracket at %i holding days", (holdingDays, percentage) => {
    const redeemedAt = new Date(Date.UTC(2026, 0, 1 + holdingDays))
      .toISOString()
      .slice(0, 10);
    const outcome = evaluate(operation({ redeemedAt }));
    expect(outcome.kind).toBe("calculated");
    if (outcome.kind === "calculated") {
      expect(outcome.result.irrf.percentage).toBe(percentage);
    }
  });

  it("reduces IOF to zero from holding day 30 onward", () => {
    const outcome = evaluate(operation({ redeemedAt: "2026-01-31" }));
    expect(outcome.kind).toBe("calculated");
    if (outcome.kind === "calculated") {
      expect(outcome.result.iof.limitPercentage).toBe("0");
      expect(moneyToDecimal(outcome.result.iof.amount)).toBe("0.00");
      expect(moneyToDecimal(outcome.result.irrf.taxableBase)).toBe("100.00");
    }
  });

  it("does not tax a redemption without a positive yield", () => {
    const outcome = evaluate(
      operation({ grossRedemptionAmount: reais("1000") }),
    );
    expect(outcome.kind).toBe("calculated");
    if (outcome.kind === "calculated") {
      expect(moneyToDecimal(outcome.result.grossYield)).toBe("0.00");
      expect(moneyToDecimal(outcome.result.iof.amount)).toBe("0.00");
      expect(moneyToDecimal(outcome.result.irrf.amount)).toBe("0.00");
    }
  });

  it("limits IOF by the smaller of the daily charge and yield schedule", () => {
    const outcome = evaluate(
      operation({
        redeemedAt: "2026-01-02",
        principalAmount: reais("1"),
        grossRedemptionAmount: reais("100"),
      }),
    );
    expect(outcome.kind).toBe("calculated");
    if (outcome.kind === "calculated") {
      expect(moneyToDecimal(outcome.result.iof.amount)).toBe("1.00");
      expect(outcome.result.iof.dailyPercentage).toBe("1");
      expect(outcome.result.iof.taxableDays).toBe(1);
      expect(outcome.result.iof.limitPercentage).toBe("96");
    }
  });

  it("keeps loss-making redemptions outside the supported scope", () => {
    expect(() =>
      evaluate(operation({ grossRedemptionAmount: reais("990") })),
    ).toThrow("outside the supported scope");
  });

  it("fails closed when either approved rule is missing", () => {
    expect(evaluate(operation(), [iofRule])).toEqual({
      kind: "no_rule",
      taxType: "IRRF",
    });
  });

  it("rejects a redemption on the investment date", () => {
    expect(() => evaluate(operation({ redeemedAt: "2026-01-01" }))).toThrow(
      "after the investment date",
    );
  });

  it("enforces the credit-provider capability", () => {
    const outcome = new FixedIncomeTaxEngine([iofRule, irrfRule]).evaluate({
      tenant: { id: "tenant-01", segment: "insurance_pension" },
      operation: operation(),
    });
    expect(outcome).toEqual({
      kind: "unsupported",
      reason: "segment_capability_mismatch",
    });
  });
});
