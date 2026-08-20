import type { TenantContext } from "../tenancy/tenant-context.js";
import type { Money } from "../shared/money.js";
import type { IofOperation } from "./operation.js";
import type { IofOutcome } from "./outcome.js";
import type { IofOperationType, IofRuleVersion, TaxRate } from "./rule.js";

function operationTypeOf(operation: IofOperation): IofOperationType {
  return operation.kind === "credit"
    ? "credit_pj_principal_defined"
    : "insurance_vgbl";
}

function isEffective(rule: IofRuleVersion, occurredOn: string): boolean {
  return (
    rule.effectiveFrom <= occurredOn &&
    (rule.effectiveTo === null || occurredOn < rule.effectiveTo)
  );
}

function applyRate(base: Money, rate: TaxRate, multiplier = 1): Money {
  const [whole, fraction = ""] = rate.percentage.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const numeratorRate = BigInt(whole) * scale + BigInt(fraction || "0");
  const denominator = scale * 100n;
  const numerator = base * numeratorRate * BigInt(multiplier);
  return ((numerator + denominator / 2n) / denominator) as Money;
}

function taxableBaseFor(
  operation: IofOperation,
  rule: IofRuleVersion,
): Money | { missing: string } {
  if (
    rule.treatment.kind !== "rate" ||
    rule.treatment.basePolicy.kind === "full_amount"
  ) {
    return operation.amount;
  }
  if (operation.kind !== "vgbl") return operation.amount;

  const { scope, threshold } = rule.treatment.basePolicy;
  const prior =
    operation.priorContributions[
      scope === "same_insurer" ? "sameInsurer" : "allInsurers"
    ];
  if (prior === undefined) return { missing: `prior_contributions:${scope}` };

  const taxableBefore = prior > threshold ? prior - threshold : 0n;
  const total = prior + operation.amount;
  const taxableAfter = total > threshold ? total - threshold : 0n;
  return (taxableAfter - taxableBefore) as Money;
}

export interface EvaluateIofInput {
  tenant: Pick<TenantContext, "id" | "segment">;
  operation: IofOperation;
}

export class IofEngine {
  constructor(private readonly rules: readonly IofRuleVersion[]) {}

  evaluate({ tenant, operation }: EvaluateIofInput): IofOutcome {
    const hasCapability =
      (tenant.segment === "credit_provider" && operation.kind === "credit") ||
      (tenant.segment === "insurance_pension" && operation.kind === "vgbl");
    if (!hasCapability)
      return { kind: "unsupported", reason: "segment_capability_mismatch" };

    const operationType = operationTypeOf(operation);
    const applicable = this.rules.filter(
      (rule) =>
        rule.status === "approved" &&
        rule.operationType === operationType &&
        isEffective(rule, operation.occurredOn),
    );

    if (applicable.length === 0) return { kind: "no_rule", operationType };
    if (applicable.length > 1) {
      return {
        kind: "ambiguous_rule",
        ruleIds: applicable.map((rule) => rule.id),
      };
    }

    const rule = applicable[0];
    if (operation.kind === "vgbl" && operation.payer === "employer") {
      return {
        kind: "not_applicable",
        ruleId: rule.id,
        reason: "employer_paid_vgbl",
      };
    }
    if (rule.treatment.kind === "not_applicable") {
      return {
        kind: "not_applicable",
        ruleId: rule.id,
        reason: rule.treatment.reason,
      };
    }

    const taxableBase = taxableBaseFor(operation, rule);
    if (typeof taxableBase === "object") {
      return { kind: "requires_context", missing: [taxableBase.missing] };
    }
    const multiplier =
      operation.kind === "credit" &&
      rule.treatment.rate.unit === "daily_percent"
        ? Math.min(operation.termInDays, 365)
        : 1;
    const primaryAmount = applyRate(
      taxableBase,
      rule.treatment.rate,
      multiplier,
    );
    const additionalAmount = rule.treatment.additionalRate
      ? applyRate(operation.amount, rule.treatment.additionalRate)
      : (0n as Money);

    return {
      kind: "calculated",
      result: {
        amount: (primaryAmount + additionalAmount) as Money,
        taxableBase,
        grossBase: operation.amount,
        ruleId: rule.id,
        ruleVersion: rule.version,
        operationType,
        effectivePeriod: { from: rule.effectiveFrom, to: rule.effectiveTo },
        rate: rule.treatment.rate,
        additionalRate: rule.treatment.additionalRate,
        legalBasis: rule.legalBasis,
        evidence: [
          `classified_as:${operationType}`,
          `rule:${rule.id}:v${rule.version}`,
          ...(operation.kind === "credit"
            ? [`taxable_days:${multiplier}`]
            : []),
        ],
      },
    };
  }
}
