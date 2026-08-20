import { Prisma, type PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import {
  decodeCalculationExportColumns,
  decodeCalculationExportFilters,
  type CalculationExportRepository,
  type CalculationExportSummary,
} from "../../application/calculation-exports.js";
import { jsonObject, jsonValue } from "./json.js";

function requiredJson(value: unknown): Prisma.InputJsonValue {
  const encoded = jsonValue(value);
  if (encoded === null) throw new Error("Expected a non-null JSON value.");
  return encoded;
}

function summary(artifact: {
  id: string;
  status: CalculationExportSummary["status"];
  format: CalculationExportSummary["format"];
  columns: Prisma.JsonValue;
  filters: Prisma.JsonValue;
  fileName: string | null;
  rowCount: number;
  errorMessage: string | null;
  createdAt: Date;
  readyAt: Date | null;
}): CalculationExportSummary {
  return {
    id: artifact.id,
    status: artifact.status,
    format: artifact.format,
    columns: decodeCalculationExportColumns(artifact.columns),
    filters: decodeCalculationExportFilters(artifact.filters),
    fileName: artifact.fileName,
    rowCount: artifact.rowCount,
    errorMessage: artifact.errorMessage,
    createdAt: artifact.createdAt.toISOString(),
    readyAt: artifact.readyAt?.toISOString() ?? null,
  };
}

export function createPrismaCalculationExportRepository(
  prisma: PrismaClient,
): CalculationExportRepository {
  return {
    async request(input) {
      return prisma.$transaction(async (transaction) => {
        const artifact = await transaction.exportArtifact.create({
          data: {
            id: input.id,
            organizationId: input.tenantId,
            createdById: input.actorUserId,
            format: input.format,
            columns: requiredJson(input.columns),
            filters: requiredJson(input.filters),
          },
        });
        const jobId = uuidv7();
        await transaction.backgroundJob.create({
          data: {
            id: jobId,
            organizationId: input.tenantId,
            createdById: input.actorUserId,
            exportId: artifact.id,
            type: "exports.generate",
            payload: requiredJson({
              exportId: artifact.id,
              options: input.options,
            }),
            correlationId: uuidv7(),
          },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.actorUserId,
            organizationId: input.tenantId,
            action: "calculation_export.requested",
            entityType: "ExportArtifact",
            entityId: artifact.id,
            after: jsonObject({
              jobId,
              format: input.format,
              columns: input.columns,
              filters: input.filters,
              options: input.options,
            }),
          },
        });
        return { artifact: summary(artifact), jobId };
      });
    },
    async list(tenantId, limit) {
      const artifacts = await prisma.exportArtifact.findMany({
        where: { organizationId: tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return artifacts.map(summary);
    },
    async downloadable(tenantId, exportId) {
      const artifact = await prisma.exportArtifact.findFirst({
        where: {
          id: exportId,
          organizationId: tenantId,
          status: "ready",
          objectKey: { not: null },
          fileName: { not: null },
          contentType: { not: null },
        },
        select: { objectKey: true, fileName: true, contentType: true },
      });
      if (!artifact?.objectKey || !artifact.fileName || !artifact.contentType) {
        return null;
      }
      return {
        objectKey: artifact.objectKey,
        fileName: artifact.fileName,
        contentType: artifact.contentType,
      };
    },
  };
}
