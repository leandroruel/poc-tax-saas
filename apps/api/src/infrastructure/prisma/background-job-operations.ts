import type { PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { BackgroundJobOperations } from "../../application/ports/background-job-operations.js";
import { jsonObject } from "./json.js";

export function createPrismaBackgroundJobOperations(
  prisma: PrismaClient,
): BackgroundJobOperations {
  return {
    async retry(input) {
      return prisma.$transaction(async (transaction) => {
        const job = await transaction.backgroundJob.findFirst({
          where: { id: input.jobId, organizationId: input.tenantId },
        });
        if (!job) return { kind: "not_found" } as const;
        if (job.status !== "failed") {
          return { kind: "not_retryable", reason: "not_failed" } as const;
        }
        if (job.maxAttempts >= 20) {
          return { kind: "not_retryable", reason: "attempt_limit" } as const;
        }
        const maxAttempts = Math.min(20, job.maxAttempts + 3);
        await transaction.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: "queued",
            maxAttempts,
            dispatchVersion: { increment: 1 },
            finishedAt: null,
          },
        });
        if (job.batchId) {
          await transaction.importBatch.update({
            where: { id: job.batchId },
            data: {
              status: job.type === "imports.validate" ? "validating" : "processing",
            },
          });
        }
        if (job.exportId) {
          await transaction.exportArtifact.update({
            where: { id: job.exportId },
            data: {
              status: "queued",
              objectKey: null,
              fileName: null,
              contentType: null,
              rowCount: 0,
              errorMessage: null,
              readyAt: null,
            },
          });
        }
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.actorUserId,
            organizationId: input.tenantId,
            action: "background_job.retry_requested",
            entityType: "BackgroundJob",
            entityId: job.id,
            before: jsonObject({ status: job.status, maxAttempts: job.maxAttempts }),
            after: jsonObject({ status: "queued", maxAttempts }),
          },
        });
        return { kind: "queued" } as const;
      });
    },
  };
}
