import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { parseCsv } from "../domain/operations/csv.js";
import {
  missingMappedColumns,
  type ImportMapping,
  type ImportOperationType,
} from "../domain/operations/import-mapping.js";
import type { TenantSegment } from "../domain/tenancy/tenant-context.js";
import { tenantObjectKey, type ObjectStorage } from "./ports/object-storage.js";

export interface ImportBatchSummary {
  readonly id: string;
  readonly status:
    | "draft"
    | "validating"
    | "ready"
    | "processing"
    | "requires_review"
    | "closed"
    | "failed"
    | "cancelled";
  readonly originalFileName: string | null;
  readonly operationType: ImportOperationType | null;
  readonly headers: readonly string[];
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly processedRows: number;
  readonly failedRows: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImportBatchDetail extends ImportBatchSummary {
  readonly mapping: ImportMapping | null;
  readonly rowErrors: readonly {
    rowNumber: number;
    rawData: Readonly<Record<string, string>>;
    errors: readonly { field: string; code: string; message: string }[];
  }[];
}

export type ImportBatchReviewRowStatus = "invalid" | "failed";

export interface ImportBatchReviewRow {
  readonly rowNumber: number;
  readonly status: ImportBatchReviewRowStatus;
  readonly rawData: Readonly<Record<string, string>>;
  readonly normalizedInput: Readonly<Record<string, unknown>> | null;
  readonly errors: readonly { field: string; code: string; message: string }[];
  readonly calculationId: string | null;
}

export interface ImportBatchReviewPage {
  readonly items: readonly ImportBatchReviewRow[];
  readonly nextRowNumber: number | null;
}

export class ImportBatchNotFoundError extends Error {}
export class ImportBatchConflictError extends Error {}
export class DuplicateImportFileError extends Error {
  constructor(readonly existingBatchId: string) {
    super("This file was already uploaded to this organization.");
  }
}

export interface ImportBatchRepository {
  createUploaded(input: {
    id: string;
    tenantId: string;
    actorUserId: string;
    originalFileName: string;
    objectKey: string;
    contentHash: string;
    delimiter: string;
    headers: readonly string[];
    totalRows: number;
  }): Promise<ImportBatchSummary>;
  configureValidation(input: {
    tenantId: string;
    actorUserId: string;
    batchId: string;
    mapping: ImportMapping;
    profileName?: string;
  }): Promise<{ jobId: string }>;
  queueProcessing(input: {
    tenantId: string;
    actorUserId: string;
    batchId: string;
  }): Promise<{ jobId: string }>;
  list(tenantId: string, limit: number): Promise<readonly ImportBatchSummary[]>;
  get(tenantId: string, batchId: string): Promise<ImportBatchDetail | null>;
  listReviewRows(input: {
    tenantId: string;
    batchId: string;
    statuses: readonly ImportBatchReviewRowStatus[];
    afterRowNumber?: number;
    limit: number;
  }): Promise<ImportBatchReviewPage>;
  closeReview(input: {
    tenantId: string;
    actorUserId: string;
    batchId: string;
    note: string;
    acknowledgedInvalidRows: boolean;
    acknowledgedFailedRows: boolean;
  }): Promise<ImportBatchSummary>;
  cancel(input: {
    tenantId: string;
    actorUserId: string;
    batchId: string;
    reason: string;
  }): Promise<ImportBatchSummary>;
}

export interface ImportBatchWorkflow {
  upload(input: {
    tenantId: string;
    actorUserId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<ImportBatchSummary>;
  configure(input: {
    tenantId: string;
    actorUserId: string;
    segment: TenantSegment;
    batchId: string;
    mapping: ImportMapping;
    profileName?: string;
  }): Promise<{ jobId: string }>;
  process(input: {
    tenantId: string;
    actorUserId: string;
    batchId: string;
  }): Promise<{ jobId: string }>;
  list(tenantId: string, limit: number): Promise<readonly ImportBatchSummary[]>;
  get(tenantId: string, batchId: string): Promise<ImportBatchDetail | null>;
  reviewRows(input: {
    tenantId: string;
    batchId: string;
    statuses: readonly ImportBatchReviewRowStatus[];
    afterRowNumber?: number;
    limit: number;
  }): Promise<ImportBatchReviewPage>;
  closeReview(input: {
    tenantId: string;
    actorUserId: string;
    batchId: string;
    note: string;
    acknowledgedInvalidRows: boolean;
    acknowledgedFailedRows: boolean;
  }): Promise<ImportBatchSummary>;
  cancel(input: {
    tenantId: string;
    actorUserId: string;
    batchId: string;
    reason: string;
  }): Promise<ImportBatchSummary>;
}

const capabilityBySegment: Partial<Record<TenantSegment, ImportOperationType>> = {
  credit_provider: "credit_pj_principal_defined",
  insurance_pension: "insurance_vgbl",
};

export function createImportBatchWorkflow(dependencies: {
  repository: ImportBatchRepository;
  storage: ObjectStorage;
}): ImportBatchWorkflow {
  return {
    async upload(input) {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
      const parsed = parseCsv(text);
      if (parsed.rows.length === 0) throw new ImportBatchConflictError("empty_batch");
      const contentHash = createHash("sha256").update(input.bytes).digest("hex");
      const id = uuidv7();
      const objectKey = tenantObjectKey({
        tenantId: input.tenantId,
        category: "imports",
        objectId: contentHash,
        extension: "csv",
      });
      await dependencies.storage.put({
        key: objectKey,
        bytes: input.bytes,
        contentType: input.contentType,
        metadata: { batchId: id, contentHash },
      });
      return dependencies.repository.createUploaded({
        id,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        originalFileName: input.fileName,
        objectKey,
        contentHash,
        delimiter: parsed.delimiter,
        headers: parsed.headers,
        totalRows: parsed.rows.length,
      });
    },
    async configure(input) {
      if (capabilityBySegment[input.segment] !== input.mapping.operationType) {
        throw new ImportBatchConflictError("segment_capability_mismatch");
      }
      const batch = await dependencies.repository.get(input.tenantId, input.batchId);
      if (!batch) throw new ImportBatchNotFoundError();
      if (missingMappedColumns(batch.headers, input.mapping).length > 0) {
        throw new ImportBatchConflictError("mapping_references_missing_columns");
      }
      return dependencies.repository.configureValidation(input);
    },
    process: (input) => dependencies.repository.queueProcessing(input),
    list: (tenantId, limit) => dependencies.repository.list(tenantId, limit),
    get: (tenantId, batchId) => dependencies.repository.get(tenantId, batchId),
    reviewRows: (input) => dependencies.repository.listReviewRows(input),
    async closeReview(input) {
      const note = input.note.trim();
      if (note.length < 5) {
        throw new ImportBatchConflictError("review_note_required");
      }
      return dependencies.repository.closeReview({ ...input, note });
    },
    async cancel(input) {
      const reason = input.reason.trim();
      if (reason.length < 5) {
        throw new ImportBatchConflictError("cancellation_reason_required");
      }
      return dependencies.repository.cancel({ ...input, reason });
    },
  };
}
