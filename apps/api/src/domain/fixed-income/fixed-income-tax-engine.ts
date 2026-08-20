import type { TenantContext } from "../tenancy/tenant-context.js";
import { elapsedCalendarDays } from "../shared/local-date.js";
import type { Money } from "../shared/money.js";
import { applyPercentage } from "../shared/percentage.js";
import type { FixedIncomeRedemption } from "./operation.js";
import type { FixedIncomeTaxOutcome } from "./outcome.js";
import type {
  FixedIncomeIofRuleVersion,
  FixedIncomeIrrfRuleVersion,
  FixedIncomeTaxRuleVersion,
} from "./rule.js";

function isEffective(
  rule: FixedIncomeTaxRuleVersion,
  redeemedAt: string,
): boolean {
  return (
    rule.status === "approved" &&
    rule.effectiveFrom <= redeemedAt &&
    (rule.effectiveTo === null || redeemedAt < rule.effectiveTo)
  );
}

function assertOperation(operation: FixedIncomeRedemption): number {
  const holdingDays = elapsedCalendarDays(
    operation.investedAt,
    operation.redeemedAt,
  );
  if (!Number.isSafeInteger(holdingDays) || holdingDays < 1) {
    throw new RangeError("Redemption must occur after the investment date.");
  }
  if (operation.grossRedemptionAmount < operation.principalAmount) {
    throw new RangeError(
      "Loss-making redemptions are outside the supported scope.",
    );
  }
  return holdingDays;
}

function assertIofTreatment(rule: FixedIncomeIofRuleVersion): void {
  if (
    rule.treatment.limitPercentages.length !== 30 ||
    rule.treatment.limitPercentages.at(-1) !== "0" ||
    rule.treatment.limitPercentages.some(
      (percentage) =>
        !/^\d+(?:\.\d+)?$/.test(percentage) || Number(percentage) > 100,
    )
  ) {
    throw new Error("IOF fixed-income schedule must cover days 1 through 30.");
  }
}

function assertIrrfTreatment(rule: FixedIncomeIrrfRuleVersion): void {
  let priorBoundary = 0;
  const { brackets } = rule.treatment;
  const valid =
    brackets.length > 0 &&
    brackets.every((bracket, index) => {
      const isLast = index === brackets.length - 1;
      if (!/^\d+(?:\.\d+)?$/.test(bracket.percentage)) return false;
      if (bracket.throughDays === null) return isLast;
      if (!Number.isSafeInteger(bracket.throughDays)) return false;
      const increasing = bracket.throughDays > priorBoundary;
      priorBoundary = bracket.throughDays;
      return increasing && !isLast;
    });
  if (!valid) throw new Error("IRRF fixed-income brackets are invalid.");
}

function irrfPercentage(
  rule: FixedIncomeIrrfRuleVersion,
  holdingDays: number,
): string {
  const bracket = rule.treatment.brackets.find(
    ({ throughDays }) => throughDays === null || holdingDays <= throughDays,
  );
  if (!bracket) throw new Error("IRRF fixed-income brackets are incomplete.");
  return bracket.percentage;
}

function onlyEffectiveRule<T extends FixedIncomeTaxRuleVersion>(input: {
  readonly taxType: T["taxType"];
  readonly redeemedAt: string;
  readonly rules: readonly FixedIncomeTaxRuleVersion[];
}):
  | { readonly kind: "selected"; readonly rule: T }
  | { readonly kind: "no_rule" }
  | { readonly kind: "ambiguous"; readonly ruleIds: readonly string[] } {
  const applicable = input.rules.filter(
    (rule) =>
      rule.taxType === input.taxType && isEffective(rule, input.redeemedAt),
  );
  if (applicable.length === 0) return { kind: "no_rule" };
  if (applicable.length > 1) {
    return { kind: "ambiguous", ruleIds: applicable.map(({ id }) => id) };
  }
  return { kind: "selected", rule: applicable[0] as T };
}

export class FixedIncomeTaxEngine {
  constructor(private readonly rules: readonly FixedIncomeTaxRuleVersion[]) {}

  evaluate(input: {
    readonly tenant: Pick<TenantContext, "id" | "segment">;
    readonly operation: FixedIncomeRedemption;
  }): FixedIncomeTaxOutcome {
    const holdingDays = assertOperation(input.operation);
    if (input.tenant.segment !== "credit_provider") {
      return { kind: "unsupported", reason: "segment_capability_mismatch" };
    }
    const iofSelection = onlyEffectiveRule<FixedIncomeIofRuleVersion>({
      taxType: "IOF",
      redeemedAt: input.operation.redeemedAt,
      rules: this.rules,
    });
    if (iofSelection.kind === "no_rule") {
      return { kind: "no_rule", taxType: "IOF" };
    }
    if (iofSelection.kind === "ambiguous") {
      return {
        kind: "ambiguous_rule",
        taxType: "IOF",
        ruleIds: iofSelection.ruleIds,
      };
    }
    const irrfSelection = onlyEffectiveRule<FixedIncomeIrrfRuleVersion>({
      taxType: "IRRF",
      redeemedAt: input.operation.redeemedAt,
      rules: this.rules,
    });
    if (irrfSelection.kind === "no_rule") {
      return { kind: "no_rule", taxType: "IRRF" };
    }
    if (irrfSelection.kind === "ambiguous") {
      return {
        kind: "ambiguous_rule",
        taxType: "IRRF",
        ruleIds: irrfSelection.ruleIds,
      };
    }

    assertIofTreatment(iofSelection.rule);
    assertIrrfTreatment(irrfSelection.rule);
    const { principalAmount, grossRedemptionAmount } = input.operation;
    const grossYield = (grossRedemptionAmount > principalAmount
      ? grossRedemptionAmount - principalAmount
      : 0n) as Money;
    const iofPercentage =
      holdingDays <= 30
        ? iofSelection.rule.treatment.limitPercentages[holdingDays - 1]
        : "0";
    const taxableDays = Math.min(holdingDays, 30);
    const dailyAmount =
      holdingDays >= 30
        ? (0n as Money)
        : applyPercentage(grossRedemptionAmount, "1", taxableDays);
    const yieldLimitAmount = applyPercentage(grossYield, iofPercentage);
    const iofAmount = (dailyAmount < yieldLimitAmount
      ? dailyAmount
      : yieldLimitAmount) as Money;
    const irrfBase = (grossYield - iofAmount) as Money;
    const incomeTaxPercentage = irrfPercentage(irrfSelection.rule, holdingDays);
    const irrfAmount = applyPercentage(irrfBase, incomeTaxPercentage);

    return {
      kind: "calculated",
      result: {
        operationType: "fixed_income_redemption",
        holdingDays,
        principalAmount,
        grossRedemptionAmount,
        grossYield,
        iof: {
          taxType: "IOF",
          amount: iofAmount,
          redemptionBase: grossRedemptionAmount,
          yieldLimitBase: grossYield,
          dailyPercentage: "1",
          taxableDays,
          limitPercentage: iofPercentage,
          ruleId: iofSelection.rule.id,
          ruleVersion: iofSelection.rule.version,
          legalBasis: iofSelection.rule.legalBasis,
          revenueCode: iofSelection.rule.treatment.revenueCode,
        },
        irrf: {
          taxType: "IRRF",
          amount: irrfAmount,
          taxableBase: irrfBase,
          percentage: incomeTaxPercentage,
          ruleId: irrfSelection.rule.id,
          ruleVersion: irrfSelection.rule.version,
          legalBasis: irrfSelection.rule.legalBasis,
          revenueCode: irrfSelection.rule.treatment.revenueCode,
        },
        netRedemptionAmount: (grossRedemptionAmount -
          iofAmount -
          irrfAmount) as Money,
        evidence: [
          "classified_as:fixed_income_redemption",
          `holding_days:${holdingDays}`,
          `iof_rule:${iofSelection.rule.id}:v${iofSelection.rule.version}`,
          `irrf_rule:${irrfSelection.rule.id}:v${irrfSelection.rule.version}`,
          "calculation_order:IOF_then_IRRF",
          `rounding:${irrfSelection.rule.rounding}`,
        ],
      },
    };
  }
}
