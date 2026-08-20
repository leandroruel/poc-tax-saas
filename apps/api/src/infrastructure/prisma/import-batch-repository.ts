import { Prisma, type PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type {
  ImportBatchDetail,
  ImportBatchRepository,
  ImportBatchSummary,
} from "../../application/import-batches.js";
import {
  DuplicateImportFileError,
  ImportBatchConflictError,
  ImportBatchNotFoundError,
} from "../../application/import-batches.js";
import type { ImportMapping } from "../../domain/operations/import-mapping.js";
import { jsonValue } from "./json.js";

function requiredJson(value: unknown): Prisma.InputJsonValue {
  const encoded = jsonValue(value);
  if (encoded === null) throw new Error("Expected a non-null JSON value.");
  return encoded;
}

function headersOf(value: Prisma.JsonValue | null): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function mappingOf(value: Prisma.JsonValue | null): ImportMapping | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as unknown as ImportMapping)
    : null;
}

function summary(batch: {
  id: string;
  status: ImportBatchSummary["status"];
  originalFileName: string | null;
  operationType: string | null;
  detectedHeaders: Prisma.JsonValue | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  processedRows: number;
  failedRows: number;
  createdAt: Date;
  updatedAt: Date;
}): ImportBatchSummary {
  return {
    id: batch.id,
    status: batch.status,
    originalFileName: batch.originalFileName,
    operationType: batch.operationType as ImportBatchSummary["operationType"],
    headers: headersOf(batch.detectedHeaders),
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    invalidRows: batch.invalidRows,
    processedRows: batch.processedRows,
    failedRows: batch.failedRows,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}

export function createPrismaImportBatchRepository(
  prisma: PrismaClient,
): ImportBatchRepository {
  return {
    async createUploaded(input) {
      try {
        const batch = await prisma.$transaction(async (transaction) => {
          const created = await transaction.importBatch.create({
            data: {
              id: input.id,
              organizationId: input.tenantId,
              createdById: input.actorUserId,
              originalFileName: input.originalFileName,
              objectKey: input.objectKey,
              contentHash: input.contentHash,
              delimiter: input.delimiter,
              detectedHeaders: requiredJson(input.headers),
              totalRows: input.totalRows,
            },
          });
          await transaction.auditLog.create({
            data: {
              id: uuidv7(),
              actorUserId: input.actorUserId,
              organizationId: input.tenantId,
              action: "import.batch_uploaded",
              entityType: "ImportBatch",
              entityId: input.id,
              after: requiredJson({
                fileName: input.originalFileName,
                contentHash: input.contentHash,
                totalRows: input.totalRows,
              }),
            },
          });
          return created;
        });
        return summary(batch);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await prisma.importBatch.findFirst({
            where: { organizationId: input.tenantId, contentHash: input.contentHash },
            select: { id: true },
          });
          if (existing) throw new DuplicateImportFileError(existing.id);
        }
        throw error;
      }
    },
    async configureValidation(input) {
      return prisma.$transaction(async (transaction) => {
        const batch = await transaction.importBatch.findFirst({
          where: { id: input.batchId, organizationId: input.tenantId },
          select: { id: true, status: true },
        });
        if (!batch) throw new ImportBatchNotFoundError();
        if (batch.status !== "draft" && batch.status !== "failed") {
          throw new ImportBatchConflictError("batch_not_configurable");
        }
        let mappingProfileId: string | undefined;
        if (input.profileName) {
          const profile = await transaction.importMappingProfile.upsert({
            where: {
              organizationId_name: {
                organizationId: input.tenantId,
                name: input.profileName,
              },
            },
            update: {
              operationType: input.mapping.operationType,
              mapping: requiredJson(input.mapping),
            },
            create: {
              id: uuidv7(),
              organizationId: input.tenantId,
              createdById: input.actorUserId,
              name: input.profileName,
              operationType: input.mapping.operationType,
              mapping: requiredJson(input.mapping),
            },
          });
          mappingProfileId = profile.id;
        }
        await transaction.importBatchRow.deleteMany({ where: { batchId: batch.id } });
        await transaction.importBatch.update({
          where: { id: batch.id },
          data: {
            status: "validating",
            operationType: input.mapping.operationType,
            mapping: requiredJson(input.mapping),
            mappingProfileId,
            validRows: 0,
            invalidRows: 0,
            processedRows: 0,
            failedRows: 0,
          },
        });
        const jobId = uuidv7();
        await transaction.backgroundJob.create({
          data: {
            id: jobId,
            organizationId: input.tenantId,
            createdById: input.actorUserId,
            batchId: batch.id,
            type: "imports.validate",
            payload: requiredJson({ batchId: batch.id }),
            correlationId: uuidv7(),
          },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.actorUserId,
            organizationId: input.tenantId,
            action: "import.validation_requested",
            entityType: "ImportBatch",
            entityId: batch.id,
            after: requiredJson({ jobId, mapping: input.mapping }),
          },
        });
        return { jobId };
      });
    },
    async queueProcessing(input) {
      return prisma.$transaction(async (transaction) => {
        const batch = await transaction.importBatch.findFirst({
          where: { id: input.batchId, organizationId: input.tenantId },
          select: { id: true, status: true },
        });
        if (!batch) throw new ImportBatchNotFoundError();
        if (batch.status !== "ready" && batch.status !== "requires_review") {
          throw new ImportBatchConflictError("batch_not_ready");
        }
        await transaction.importBatchRow.updateMany({
          where: { batchId: batch.id, status: "failed" },
          data: { status: "valid", validationErrors: Prisma.DbNull },
        });
        const rowsToProcess = await transaction.importBatchRow.count({
          where: { batchId: batch.id, status: "valid" },
        });
        if (!rowsToProcess) {
          throw new ImportBatchConflictError("batch_has_no_valid_rows");
        }
        await transaction.importBatch.update({
          where: { id: batch.id },
          data: { status: "processing", failedRows: 0 },
        });
        const jobId = uuidv7();
        await transaction.backgroundJob.create({
          data: {
            id: jobId,
            organizationId: input.tenantId,
            createdById: input.actorUserId,
            batchId: batch.id,
            type: "imports.process",
            payload: requiredJson({ batchId: batch.id }),
            progressTotal: rowsToProcess,
            correlationId: uuidv7(),
          },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.actorUserId,
            organizationId: input.tenantId,
            action: "import.processing_requested",
            entityType: "ImportBatch",
            entityId: batch.id,
            after: requiredJson({ jobId, rowsToProcess }),
          },
        });
        return { jobId };
      });
    },
    async list(tenantId, limit) {
      const batches = await prisma.importBatch.findMany({
        where: { organizationId: tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return batches.map(summary);
    },
    async get(tenantId, batchId) {
      const batch = await prisma.importBatch.findFirst({
        where: { id: batchId, organizationId: tenantId },
        include: {
          rows: {
            where: { status: { in: ["invalid", "failed"] } },
            orderBy: { rowNumber: "asc" },
            take: 20,
          },
        },
      });
      if (!batch) return null;
      return {
        ...summary(batch),
        mapping: mappingOf(batch.mapping),
        rowErrors: batch.rows.map((row) => ({
          rowNumber: row.rowNumber,
          rawData: row.rawData as Readonly<Record<string, string>>,
          errors: (row.validationErrors ?? []) as unknown as ImportBatchDetail["rowErrors"][number]["errors"],
        })),
      };
    },
  };
}
