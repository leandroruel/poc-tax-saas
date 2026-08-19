import type { TaxOutcome, TaxResult } from "../../domain/calculation.js";
import { moneyToNumber } from "../../domain/money.js";

function resultDto(result: TaxResult) {
  return {
    taxType: result.taxType,
    amount: moneyToNumber(result.amount),
    taxableBase: moneyToNumber(result.taxableBase),
    base: moneyToNumber(result.grossBase),
    ruleId: result.ruleId,
    ruleVersion: result.ruleVersion,
    operationType: result.operationType,
    effectivePeriod: result.effectivePeriod,
    rate: Number(result.rate.percentage),
    rateUnit: result.rate.unit,
    additionalRate: result.additionalRate ? Number(result.additionalRate.percentage) : undefined,
    additionalRateUnit: result.additionalRate?.unit,
    legalBasis: result.legalBasis,
    evidence: result.evidence,
  };
}

function narrative(outcome: TaxOutcome): string {
  if (outcome.kind === "calculated" || outcome.kind === "calculated_with_warning") {
    const result = outcome.result;
    return `${result.taxType} calculado pela regra ${result.operationType} v${result.ruleVersion}; base tributável R$ ${moneyToNumber(result.taxableBase).toFixed(2)}. Fundamento: ${result.legalBasis}.`;
  }
  if (outcome.kind === "unclassified") return `Operação não classificada: ${outcome.reasons.join(", ")}.`;
  if (outcome.kind === "no_rule") return `Nenhuma regra vigente para: ${outcome.operationTypes.join(", ")}.`;
  if (outcome.kind === "not_applicable") return `IOF não aplicável: ${outcome.reasons.join(", ")}.`;
  if (outcome.kind === "requires_context") return `Cálculo requer contexto adicional: ${outcome.missing.join(", ")}.`;
  if (outcome.kind === "requires_review") return `A regra ${outcome.ruleId} requer revisão antes do cálculo.`;
  return `Conflito entre regras vigentes: ${outcome.ruleIds.join(", ")}.`;
}

export function presentCalculation(calculationId: string, outcome: TaxOutcome) {
  const result =
    outcome.kind === "calculated" || outcome.kind === "calculated_with_warning"
      ? resultDto(outcome.result)
      : null;
  return {
    calculationId,
    status: outcome.kind,
    results: result ? [result] : [],
    warnings: outcome.kind === "calculated_with_warning" ? outcome.warnings : [],
    explanation: {
      narrative: narrative(outcome),
      evidence: result?.evidence ?? [],
    },
  };
}
