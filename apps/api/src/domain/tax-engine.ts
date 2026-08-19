import type { TaxOutcome, TaxResult } from "./calculation.js";
import { moneyToDecimal, type Money } from "./money.js";
import type { InsuranceOperation, LocalDate, TaxOperation } from "./operation.js";
import type { OperationType, TaxRule } from "./tax-rule.js";

export interface EvaluateTaxInput {
  taxType: "IOF";
  asOf: LocalDate;
  operation: TaxOperation;
  rules: readonly TaxRule[];
}

function isEffective(rule: TaxRule, asOf: LocalDate): boolean {
  return rule.effectiveFrom <= asOf && (rule.effectiveTo === null || asOf < rule.effectiveTo);
}

function classify(operation: TaxOperation): readonly OperationType[] {
  if (operation.kind === "insurance") return ["insurance_vgbl"];
  if (operation.kind === "credit") {
    if (operation.borrower.personType !== "PJ") return [];
    return operation.optedIntoSimples || operation.borrower.category === "simples_mei"
      ? ["credit_simples_mei", "credit_pj"]
      : ["credit_pj"];
  }
  if (operation.kind === "foreign_exchange") {
    return [`foreign_exchange_${operation.direction}`];
  }
  if (operation.kind === "investment" && operation.instrument === "fidc") {
    return ["investment_fidc"];
  }
  return [];
}

function thresholdBase(
  operation: InsuranceOperation,
  rule: TaxRule
): Money | { missing: string } {
  if (rule.basePolicy.kind !== "aggregate_threshold") return operation.amount;

  const prior = operation.priorContributions[rule.basePolicy.scope === "same_insurer" ? "sameInsurer" : "allInsurers"];
  if (prior === undefined) return { missing: `prior_contributions:${rule.basePolicy.scope}` };

  const before = prior > rule.basePolicy.threshold ? prior - rule.basePolicy.threshold : 0n;
  const total = prior + operation.amount;
  const after = total > rule.basePolicy.threshold ? total - rule.basePolicy.threshold : 0n;
  return (after - before) as Money;
}

function applyRate(base: Money, percentage: string, multiplier = 1): Money {
  const [whole, fraction = ""] = percentage.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const rateNumerator = BigInt(whole) * scale + BigInt(fraction || "0");
  const denominator = scale * 100n;
  const numerator = base * rateNumerator * BigInt(multiplier);
  return ((numerator + denominator / 2n) / denominator) as Money;
}

function failedConditions(operation: TaxOperation, rule: TaxRule): readonly string[] {
  return rule.conditions.flatMap((condition) => {
    if (condition.kind === "maximum_amount") {
      return operation.amount <= condition.amount
        ? []
        : [`condition_failed:maximum_amount`];
    }
    if (condition.kind === "person_type_is") {
      const party =
        condition.role === "insured" && operation.kind === "insurance"
          ? operation.insured
          : condition.role === "borrower" && operation.kind === "credit"
          ? operation.borrower
          : undefined;
      return party?.personType === condition.value
        ? []
        : [`condition_failed:person_type_is:${condition.role}:${condition.value}`];
    }
    if (condition.kind === "payer_is") {
      const matches = operation.kind === "insurance" && operation.payer === condition.value;
      return matches ? [] : [`condition_failed:payer_is:${condition.value}`];
    }
    if (condition.kind === "market_is") {
      const matches = operation.kind === "investment" && operation.market === condition.value;
      return matches ? [] : [`condition_failed:market_is:${condition.value}`];
    }
    return [];
  });
}

function taxableBaseFor(operation: TaxOperation, rule: TaxRule): Money | { missing: string } {
  if (rule.basePolicy.kind === "full_amount") return operation.amount;
  if (operation.kind !== "insurance") return operation.amount;
  return thresholdBase(operation, rule);
}

function rateMultiplier(operation: TaxOperation, unit: TaxRule["rate"]["unit"]): number {
  if (unit !== "daily_percent") return 1;
  return operation.kind === "credit" ? Math.min(operation.termInDays, 365) : 1;
}

function evidenceFor(operation: TaxOperation, rule: TaxRule, taxableBase: Money): readonly string[] {
  const evidence = [
    `classified_as:${rule.operationType}`,
    `rule:${rule.id}:v${rule.version}`,
    `gross_base:${moneyToDecimal(operation.amount)}`,
    `taxable_base:${moneyToDecimal(taxableBase)}`,
  ];
  if (operation.kind === "credit" && rule.rate.unit === "daily_percent") {
    evidence.push(`taxable_days:${Math.min(operation.termInDays, 365)}`);
    if (operation.termInDays > 365) evidence.push(`term_days_capped_from:${operation.termInDays}`);
  }
  if (rule.basePolicy.kind === "aggregate_threshold") {
    evidence.push(`threshold_scope:${rule.basePolicy.scope}`);
    evidence.push(`threshold:${moneyToDecimal(rule.basePolicy.threshold)}`);
  }
  return evidence;
}

export function evaluateTax(input: EvaluateTaxInput): TaxOutcome {
  const operationTypes = classify(input.operation);
  if (operationTypes.length === 0) {
    return { kind: "unclassified", reasons: [`unsupported_operation:${input.operation.kind}`] };
  }

  const candidates = input.rules
    .filter(
    (rule) =>
      rule.taxType === input.taxType &&
      operationTypes.includes(rule.operationType) &&
      isEffective(rule, input.asOf)
    )
    .sort((left, right) => {
      const specificity = operationTypes.indexOf(left.operationType) - operationTypes.indexOf(right.operationType);
      return specificity !== 0 ? specificity : right.version - left.version;
    });
  if (candidates.length === 0) return { kind: "no_rule", operationTypes };

  const evaluated = candidates.map((rule) => ({ rule, failures: failedConditions(input.operation, rule) }));
  const failures: string[] = [];
  let selected: TaxRule | undefined;
  for (const operationType of operationTypes) {
    const matchingType = evaluated.filter(({ rule }) => rule.operationType === operationType);
    const applicable = matchingType.filter(({ failures: ruleFailures }) => ruleFailures.length === 0);
    if (applicable.length > 1) {
      return { kind: "ambiguous_rule", ruleIds: applicable.map(({ rule }) => rule.id) };
    }
    if (applicable.length === 1) {
      selected = applicable[0].rule;
      break;
    }
    failures.push(...matchingType.flatMap(({ failures: ruleFailures }) => ruleFailures));
  }
  if (!selected) return { kind: "not_applicable", reasons: failures };
  const rule = selected;
  if (rule.status === "needs_review") {
    return { kind: "requires_review", ruleId: rule.id, status: rule.status };
  }

  const taxableBase = taxableBaseFor(input.operation, rule);
  if (typeof taxableBase === "object") {
    return { kind: "requires_context", missing: [taxableBase.missing] };
  }

  const primaryAmount = applyRate(
    taxableBase,
    rule.rate.percentage,
    rateMultiplier(input.operation, rule.rate.unit)
  );
  const additionalAmount = rule.additionalRate
    ? applyRate(
        input.operation.amount,
        rule.additionalRate.percentage,
        rateMultiplier(input.operation, rule.additionalRate.unit)
      )
    : (0n as Money);

  const result: TaxResult = {
    taxType: input.taxType,
    amount: (primaryAmount + additionalAmount) as Money,
    taxableBase,
    grossBase: input.operation.amount,
    ruleId: rule.id,
    ruleVersion: rule.version,
    operationType: rule.operationType,
    effectivePeriod: { from: rule.effectiveFrom, to: rule.effectiveTo },
    rate: rule.rate,
    additionalRate: rule.additionalRate,
    legalBasis: rule.legalBasis,
    evidence: evidenceFor(input.operation, rule, taxableBase),
  };

  return rule.status === "contested"
    ? { kind: "calculated_with_warning", result, warnings: ["rule_status:contested"] }
    : { kind: "calculated", result };
}
