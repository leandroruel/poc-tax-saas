import type { IofOperation } from "../iof/operation.js";
import { isLocalDate } from "../iof/operation.js";
import { reais } from "../shared/money.js";

export type ImportOperationType =
  | "credit_pj_principal_defined"
  | "insurance_vgbl";
export type ImportDateFormat = "yyyy-mm-dd" | "dd/mm/yyyy";
export type ImportNumberFormat = "decimal_dot" | "decimal_comma";

interface MappingBase {
  readonly dateFormat: ImportDateFormat;
  readonly numberFormat: ImportNumberFormat;
}

export type ImportMapping =
  | (MappingBase & {
      readonly operationType: "credit_pj_principal_defined";
      readonly columns: {
        readonly occurredOn: string;
        readonly amount: string;
        readonly termInDays: string;
      };
    })
  | (MappingBase & {
      readonly operationType: "insurance_vgbl";
      readonly columns: {
        readonly occurredOn: string;
        readonly amount: string;
        readonly payer: string;
        readonly priorSameInsurer?: string;
        readonly priorAllInsurers?: string;
      };
    });

export interface ImportRowError {
  readonly field: string;
  readonly code:
    | "missing_column"
    | "required"
    | "invalid_date"
    | "invalid_money"
    | "invalid_integer"
    | "invalid_payer";
  readonly message: string;
}

export type ImportedRow =
  | { readonly ok: true; readonly operation: IofOperation }
  | { readonly ok: false; readonly errors: readonly ImportRowError[] };

export function requiredColumns(mapping: ImportMapping): readonly string[] {
  return Object.values(mapping.columns).filter(
    (column): column is string => typeof column === "string" && !!column,
  );
}

export function missingMappedColumns(
  headers: readonly string[],
  mapping: ImportMapping,
): readonly string[] {
  const available = new Set(headers);
  return requiredColumns(mapping).filter((column) => !available.has(column));
}

function parseDate(value: string, format: ImportDateFormat): string | null {
  const localDate =
    format === "dd/mm/yyyy"
      ? value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$2-$1")
      : value;
  return isLocalDate(localDate) ? localDate : null;
}

function parseMoney(value: string, format: ImportNumberFormat) {
  const pattern =
    format === "decimal_comma"
      ? /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$|^\d+(?:,\d{1,2})?$/
      : /^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(value)) return null;
  const normalized =
    format === "decimal_comma"
      ? value.replaceAll(".", "").replace(",", ".")
      : value.replaceAll(",", "");
  try {
    return reais(normalized);
  } catch {
    return null;
  }
}

export function mapImportedRow(
  values: Readonly<Record<string, string>>,
  mapping: ImportMapping,
): ImportedRow {
  const errors: ImportRowError[] = [];
  const read = (field: string, column: string | undefined): string => {
    if (!column || !(column in values)) {
      errors.push({
        field,
        code: "missing_column",
        message: "A coluna configurada não existe no arquivo.",
      });
      return "";
    }
    const value = values[column]!.trim();
    if (!value) {
      errors.push({ field, code: "required", message: "Valor obrigatório." });
    }
    return value;
  };

  const occurredOnRaw = read("occurredOn", mapping.columns.occurredOn);
  const amountRaw = read("amount", mapping.columns.amount);
  const occurredOn = parseDate(occurredOnRaw, mapping.dateFormat);
  const amount = parseMoney(amountRaw, mapping.numberFormat);
  if (occurredOnRaw && !occurredOn) {
    errors.push({
      field: "occurredOn",
      code: "invalid_date",
      message: `Use o formato ${mapping.dateFormat}.`,
    });
  }
  if (amountRaw && amount === null) {
    errors.push({
      field: "amount",
      code: "invalid_money",
      message: "Valor monetário inválido ou com mais de duas casas decimais.",
    });
  }

  if (mapping.operationType === "credit_pj_principal_defined") {
    const termRaw = read("termInDays", mapping.columns.termInDays);
    const termInDays = Number(termRaw);
    if (
      termRaw &&
      (!Number.isSafeInteger(termInDays) || termInDays <= 0)
    ) {
      errors.push({
        field: "termInDays",
        code: "invalid_integer",
        message: "Informe um prazo inteiro e positivo.",
      });
    }
    if (errors.length || !occurredOn || amount === null) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      operation: {
        kind: "credit",
        modality: "principal_defined",
        occurredOn,
        amount,
        borrower: { personType: "PJ" },
        termInDays,
      },
    };
  }

  const payerRaw = read("payer", mapping.columns.payer).toLowerCase();
  const payer =
    payerRaw === "policyholder" || payerRaw === "titular"
      ? "policyholder"
      : payerRaw === "employer" || payerRaw === "empregador"
        ? "employer"
        : null;
  if (payerRaw && !payer) {
    errors.push({
      field: "payer",
      code: "invalid_payer",
      message: "Use titular/policyholder ou empregador/employer.",
    });
  }
  const optionalMoney = (
    field: string,
    column: string | undefined,
  ) => {
    if (!column) return undefined;
    const raw = values[column]?.trim() ?? "";
    if (!raw) return undefined;
    const parsed = parseMoney(raw, mapping.numberFormat);
    if (parsed === null) {
      errors.push({
        field,
        code: "invalid_money",
        message: "Valor monetário inválido ou com mais de duas casas decimais.",
      });
      return undefined;
    }
    return parsed;
  };
  const sameInsurer = optionalMoney(
    "priorSameInsurer",
    mapping.columns.priorSameInsurer,
  );
  const allInsurers = optionalMoney(
    "priorAllInsurers",
    mapping.columns.priorAllInsurers,
  );
  if (errors.length || !occurredOn || amount === null || !payer) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    operation: {
      kind: "vgbl",
      occurredOn,
      amount,
      insured: { personType: "PF" },
      payer,
      priorContributions: { sameInsurer, allInsurers },
    },
  };
}
