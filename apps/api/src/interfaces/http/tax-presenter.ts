import type { IofOutcome, IofResult } from "../../domain/iof/outcome.js";
import { moneyToNumber } from "../../domain/shared/money.js";

function assertNever(value: never): never {
  throw new Error(`Unhandled IOF outcome: ${JSON.stringify(value)}`);
}

function operationTypeLabel(operationType: string): string {
  switch (operationType) {
    case "credit_pj_principal_defined":
      return "crédito PJ com principal e prazo definidos";
    case "insurance_vgbl":
      return "aporte em VGBL";
    default:
      return operationType;
  }
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    segment_capability_mismatch:
      "a modalidade não está habilitada para o segmento da empresa",
    employer_paid_vgbl: "o aporte foi realizado pelo empregador",
    before_decree_12499: "a operação ocorreu antes da nova hipótese legal",
    decree_12499_suspended:
      "a operação ocorreu durante a suspensão do Decreto 12.499/2025",
  };
  return labels[reason] ?? reason;
}

function missingLabel(missing: string): string {
  const labels: Record<string, string> = {
    "prior_contributions:same_insurer":
      "aportes anteriores na mesma seguradora",
    "prior_contributions:all_insurers":
      "aportes anteriores em todas as seguradoras",
  };
  return labels[missing] ?? missing;
}

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
  switch (outcome.kind) {
    case "calculated":
      return `IOF calculado pela regra de ${operationTypeLabel(outcome.result.operationType)}, versão ${outcome.result.ruleVersion}.`;
    case "unsupported":
      return `Operação não suportada: ${reasonLabel(outcome.reason)}.`;
    case "not_applicable":
      return `IOF não aplicável: ${reasonLabel(outcome.reason)}.`;
    case "requires_context":
      return `Informe: ${outcome.missing.map(missingLabel).join(", ")}.`;
    case "no_rule":
      return `Nenhuma regra aprovada vigente para ${operationTypeLabel(outcome.operationType)}.`;
    case "ambiguous_rule":
      return "Existe um conflito entre versões vigentes. O cálculo precisa de revisão administrativa.";
    default:
      return assertNever(outcome);
  }
}

function machineDetails(outcome: IofOutcome) {
  switch (outcome.kind) {
    case "calculated":
      return { operationType: outcome.result.operationType };
    case "unsupported":
    case "not_applicable":
      return { reason: outcome.reason };
    case "requires_context":
      return { missing: outcome.missing };
    case "no_rule":
      return { operationType: outcome.operationType };
    case "ambiguous_rule":
      return { ruleIds: outcome.ruleIds };
    default:
      return assertNever(outcome);
  }
}

export function presentCalculation(calculationId: string, outcome: IofOutcome) {
  return {
    calculationId,
    status: outcome.kind,
    result: outcome.kind === "calculated" ? resultDto(outcome.result) : null,
    explanation: narrative(outcome),
    details: machineDetails(outcome),
  };
}
