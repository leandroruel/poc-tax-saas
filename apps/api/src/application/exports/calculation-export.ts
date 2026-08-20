import type { CalculationRecord } from "../read-models/calculation-record.js";

export const calculationExportColumns = [
  "calculationId",
  "operationType",
  "occurredOn",
  "status",
  "taxAmount",
  "taxableBase",
  "grossBase",
  "ruleId",
  "ruleVersion",
  "legalBasis",
  "createdAt",
  "createdBy",
] as const;

export type CalculationExportColumn = (typeof calculationExportColumns)[number];

const headers: Record<CalculationExportColumn, string> = {
  calculationId: "ID do cálculo",
  operationType: "Modalidade",
  occurredOn: "Data da operação",
  status: "Status",
  taxAmount: "Valor do tributo",
  taxableBase: "Base tributável",
  grossBase: "Base bruta",
  ruleId: "ID da regra",
  ruleVersion: "Versão da regra",
  legalBasis: "Fundamento legal",
  createdAt: "Registrado em",
  createdBy: "Registrado por",
};

function valueOf(record: CalculationRecord, column: CalculationExportColumn): string {
  const result = record.outcome.kind === "calculated" ? record.outcome.result : null;
  switch (column) {
    case "calculationId": return record.id;
    case "operationType": return record.operationType;
    case "occurredOn": return record.occurredOn;
    case "status": return record.outcome.kind;
    case "taxAmount": return result?.amount ?? "";
    case "taxableBase": return result?.taxableBase ?? "";
    case "grossBase": return result?.grossBase ?? "";
    case "ruleId": return result?.ruleId ?? "";
    case "ruleVersion": return result ? String(result.ruleVersion) : "";
    case "legalBasis": return result?.legalBasis ?? "";
    case "createdAt": return record.createdAt;
    case "createdBy": return record.createdBy.name;
  }
}

function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string, delimiter: "," | ";"): string {
  const safe = neutralizeFormula(value);
  return safe.includes(delimiter) || /["\r\n]/.test(safe)
    ? `"${safe.replaceAll('"', '""')}"`
    : safe;
}

export function renderCalculationCsv(input: {
  readonly records: readonly CalculationRecord[];
  readonly columns: readonly CalculationExportColumn[];
  readonly delimiter: "," | ";";
}): string {
  if (!input.columns.length) throw new Error("At least one export column is required.");
  const lines = [
    input.columns.map((column) => csvCell(headers[column], input.delimiter)),
    ...input.records.map((record) =>
      input.columns.map((column) => csvCell(valueOf(record, column), input.delimiter)),
    ),
  ];
  return `\uFEFF${lines.map((line) => line.join(input.delimiter)).join("\r\n")}\r\n`;
}

export function calculationEvidence(records: readonly CalculationRecord[]) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    records,
  } as const;
}
