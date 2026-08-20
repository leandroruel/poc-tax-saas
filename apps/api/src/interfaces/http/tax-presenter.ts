import type { IofOutcome, IofResult } from "../../domain/iof/outcome.js";
import { moneyToNumber } from "../../domain/shared/money.js";

function resultDto(result: IofResult) {
  return {
    amount: moneyToNumber(result.amount),
    taxableBase: moneyToNumber(result.taxableBase),
    grossBase: moneyToNumber(result.grossBase),
    ruleVersionId: result.ruleId,
    ruleVersion: result.ruleVersion,
    operationType: result.operationType,
    effectivePeriod: result.effectivePeriod,
    rate: result.rate,
    additionalRate: result.additionalRate,
    legalBasis: result.legalBasis,
    evidence: result.evidence,
  };
}

function narrative(outcome: IofOutcome): string {
  if (outcome.kind === "calculated") {
    return `IOF calculado pela regra ${outcome.result.operationType} v${outcome.result.ruleVersion}.`;
  }
  if (outcome.kind === "unsupported")
    return "Esta operação não faz parte do segmento contratado.";
  if (outcome.kind === "not_applicable")
    return `IOF não aplicável: ${outcome.reason}.`;
  if (outcome.kind === "requires_context")
    return `Informe: ${outcome.missing.join(", ")}.`;
  if (outcome.kind === "no_rule")
    return `Nenhuma regra aprovada vigente para ${outcome.operationType}.`;
  return `Mais de uma regra vigente foi encontrada: ${outcome.ruleIds.join(", ")}.`;
}

export function presentCalculation(calculationId: string, outcome: IofOutcome) {
  return {
    calculationId,
    status: outcome.kind,
    result: outcome.kind === "calculated" ? resultDto(outcome.result) : null,
    explanation: narrative(outcome),
  };
}
