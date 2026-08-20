import { v7 as uuidv7 } from "uuid";
import type {
  CalculationOperationType,
  CalculationStatus,
} from "./read-models/calculation-record.js";
import {
  calculationOperationTypes,
  calculationStatuses,
} from "./read-models/calculation-record.js";
import { isLocalDate } from "../domain/iof/operation.js";
import {
  calculationExportColumns,
  type CalculationExportColumn,
} from "./exports/calculation-export.js";
import type { ObjectStorage } from "./ports/object-storage.js";

export type CalculationExportFormat = "csv" | "evidence_json";

export interface CalculationExportFilters {
  readonly calculationId?: string;
  readonly operationType?: CalculationOperationType;
  readonly status?: CalculationStatus;
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
  readonly createdThrough: string;
}

export interface CalculationExportOptions {
  readonly delimiter: "," | ";";
}

export interface CalculationExportSummary {
  readonly id: string;
  readonly status: "queued" | "ready" | "failed";
  readonly format: CalculationExportFormat;
  readonly columns: readonly CalculationExportColumn[];
  readonly filters: CalculationExportFilters;
  readonly fileName: string | null;
  readonly rowCount: number;
  readonly errorMessage: string | null;
  readonly createdAt: string;
  readonly readyAt: string | null;
}

export interface DownloadableCalculationExport {
  readonly fileName: string;
  readonly contentType: string;
  readonly objectKey: string;
}

export interface CalculationExportRepository {
  request(input: {
    readonly id: string;
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly format: CalculationExportFormat;
    readonly columns: readonly CalculationExportColumn[];
    readonly filters: CalculationExportFilters;
    readonly options: CalculationExportOptions;
  }): Promise<{ readonly artifact: CalculationExportSummary; readonly jobId: string }>;
  list(tenantId: string, limit: number): Promise<readonly CalculationExportSummary[]>;
  downloadable(
    tenantId: string,
    exportId: string,
  ): Promise<DownloadableCalculationExport | null>;
}

export class CalculationExportNotReadyError extends Error {}

export interface CalculationExportWorkflow {
  request(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly format: CalculationExportFormat;
    readonly columns?: readonly CalculationExportColumn[];
    readonly delimiter?: "," | ";";
    readonly filters: Omit<CalculationExportFilters, "createdThrough">;
  }): Promise<{ readonly artifact: CalculationExportSummary; readonly jobId: string }>;
  list(tenantId: string, limit: number): Promise<readonly CalculationExportSummary[]>;
  download(input: {
    readonly tenantId: string;
    readonly exportId: string;
  }): Promise<{
    readonly bytes: Uint8Array;
    readonly fileName: string;
    readonly contentType: string;
  } | null>;
}

function uniqueColumns(
  columns: readonly CalculationExportColumn[],
): readonly CalculationExportColumn[] {
  return [...new Set(columns)];
}

export function createCalculationExportWorkflow(dependencies: {
  readonly repository: CalculationExportRepository;
  readonly storage: ObjectStorage;
  readonly now?: () => Date;
}): CalculationExportWorkflow {
  const now = dependencies.now ?? (() => new Date());
  return {
    request(input) {
      const columns = uniqueColumns(
        input.format === "evidence_json"
          ? calculationExportColumns
          : (input.columns ?? calculationExportColumns),
      );
      if (!columns.length) {
        throw new Error("At least one export column is required.");
      }
      return dependencies.repository.request({
        id: uuidv7(),
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        format: input.format,
        columns,
        filters: { ...input.filters, createdThrough: now().toISOString() },
        options: { delimiter: input.delimiter ?? ";" },
      });
    },
    list: (tenantId, limit) => dependencies.repository.list(tenantId, limit),
    async download(input) {
      const artifact = await dependencies.repository.downloadable(
        input.tenantId,
        input.exportId,
      );
      if (!artifact) return null;
      const bytes = await dependencies.storage.get(artifact.objectKey);
      if (!bytes) throw new CalculationExportNotReadyError("Export object is missing.");
      return {
        bytes,
        fileName: artifact.fileName,
        contentType: artifact.contentType,
      };
    },
  };
}

export function decodeCalculationExportColumns(
  value: unknown,
): readonly CalculationExportColumn[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(
      (column) =>
        typeof column === "string" &&
        calculationExportColumns.includes(column as CalculationExportColumn),
    )
  ) {
    throw new Error("Stored export columns are invalid.");
  }
  return uniqueColumns(value as CalculationExportColumn[]);
}

export function decodeCalculationExportFilters(
  value: unknown,
): CalculationExportFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored export filters are invalid.");
  }
  const filters = value as Record<string, unknown>;
  if (
    typeof filters.createdThrough !== "string" ||
    !Number.isFinite(new Date(filters.createdThrough).getTime())
  ) {
    throw new Error("Stored export boundary is invalid.");
  }
  const optionalString = (name: string, maxLength = 100): string | undefined => {
    const candidate = filters[name];
    if (candidate === undefined) return undefined;
    if (
      typeof candidate !== "string" ||
      candidate.length === 0 ||
      candidate.length > maxLength
    ) {
      throw new Error(`Stored export filter ${name} is invalid.`);
    }
    return candidate;
  };
  const calculationId = optionalString("calculationId");
  const operationType = optionalString("operationType");
  const status = optionalString("status");
  const occurredFrom = optionalString("occurredFrom", 10);
  const occurredTo = optionalString("occurredTo", 10);
  if (
    operationType &&
    !calculationOperationTypes.includes(operationType as CalculationOperationType)
  ) {
    throw new Error("Stored export operation type is invalid.");
  }
  if (status && !calculationStatuses.includes(status as CalculationStatus)) {
    throw new Error("Stored export status is invalid.");
  }
  if (
    (occurredFrom && !isLocalDate(occurredFrom)) ||
    (occurredTo && !isLocalDate(occurredTo)) ||
    (occurredFrom && occurredTo && occurredFrom > occurredTo)
  ) {
    throw new Error("Stored export date range is invalid.");
  }
  return {
    calculationId,
    operationType: operationType as CalculationOperationType | undefined,
    status: status as CalculationStatus | undefined,
    occurredFrom,
    occurredTo,
    createdThrough: filters.createdThrough,
  };
}

export function decodeCalculationExportOptions(
  value: unknown,
): CalculationExportOptions {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ((value as Record<string, unknown>).delimiter !== "," &&
      (value as Record<string, unknown>).delimiter !== ";")
  ) {
    throw new Error("Stored export options are invalid.");
  }
  return { delimiter: (value as { delimiter: "," | ";" }).delimiter };
}
