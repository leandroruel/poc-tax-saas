import { UnrecoverableError } from "bullmq";
import { v7 as uuidv7 } from "uuid";
import { createCalculateTax } from "../../application/calculate-tax.js";
import {
  decodeCalculationExportColumns,
  decodeCalculationExportFilters,
  decodeCalculationExportOptions,
} from "../../application/calculation-exports.js";
import { decodeImportedOperation } from "../../application/codecs/imported-operation.js";
import {
  renderCalculationCsv,
  renderCalculationEvidence,
} from "../../application/exports/calculation-export.js";
import { parseCsv } from "../../domain/operations/csv.js";
import { mapImportedRow, type ImportMapping } from "../../domain/operations/import-mapping.js";
import { jsonValue } from "../../infrastructure/prisma/json.js";
import { createPrismaCalculationJournal } from "../../infrastructure/prisma/calculation-journal.js";
import { createPrismaCalculationLedger } from "../../infrastructure/prisma/calculation-ledger.js";
import { createPrismaRuleCatalog } from "../../infrastructure/prisma/rule-catalog.js";
import { recordScheduledRuleActivations } from "../../infrastructure/prisma/scheduled-rule-activation.js";
import { prisma } from "../../infrastructure/prisma/prisma-client.js";
import {
  createTaxmanQueue,
  createTaxmanWorker,
  type TaxmanJob,
} from "../../infrastructure/queue/taxman-queue.js";
import {
  assertS3BucketReady,
  createS3Client,
  createS3ObjectStorage,
  objectStorageConfigFromEnvironment,
} from "../../infrastructure/storage/s3-object-storage.js";
import { tenantObjectKey } from "../../application/ports/object-storage.js";

const activationJobName = "rules.activate-due";
const storageConfig = objectStorageConfigFromEnvironment();
const storageClient = createS3Client(storageConfig);
const storage = createS3ObjectStorage(storageClient, storageConfig.bucket);
await assertS3BucketReady(storageClient, storageConfig.bucket);
const calculateTax = createCalculateTax({
  ruleCatalog: createPrismaRuleCatalog(prisma),
  calculationJournal: createPrismaCalculationJournal(prisma),
});
const calculationLedger = createPrismaCalculationLedger(prisma);

const queue = createTaxmanQueue();
await queue.upsertJobScheduler(
  "activate-due-rules-every-minute",
  { every: 60_000 },
  { name: activationJobName, data: {} },
);
await queue.upsertJobScheduler(
  "dispatch-pending-jobs",
  { every: 2_000 },
  { name: "jobs.dispatch-pending", data: {} },
);

function requiredJson(value: unknown) {
  const encoded = jsonValue(value);
  if (encoded === null) throw new Error("Expected non-null JSON.");
  return encoded;
}

async function dispatchPendingJobs(): Promise<void> {
  const pending = await prisma.backgroundJob.findMany({
    where: { status: "queued" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
  });
  for (const pendingJob of pending) {
    const remaining = pendingJob.maxAttempts - pendingJob.attemptsMade;
    if (remaining <= 0) continue;
    await queue.add(
      pendingJob.type,
      { backgroundJobId: pendingJob.id },
      {
        jobId: `background-${pendingJob.id}-${pendingJob.dispatchVersion}`,
        attempts: remaining,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    );
  }
}

async function validateImportBatch(backgroundJobId: string): Promise<void> {
  const job = await prisma.backgroundJob.findUniqueOrThrow({
    where: { id: backgroundJobId },
    include: { batch: true },
  });
  if (!job.batch?.objectKey || !job.batch.mapping) {
    throw new UnrecoverableError("Import batch is missing its file or mapping.");
  }
  const bytes = await storage.get(job.batch.objectKey);
  if (!bytes) throw new Error("Import source object was not found.");
  const parsed = parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const mapping = job.batch.mapping as unknown as ImportMapping;
  const rows = parsed.rows.map((row) => {
    const mapped = mapImportedRow(row.values, mapping);
    return {
      id: uuidv7(),
      batchId: job.batch!.id,
      rowNumber: row.rowNumber,
      status: mapped.ok ? ("valid" as const) : ("invalid" as const),
      rawData: requiredJson(row.values),
      normalizedInput: mapped.ok ? requiredJson(mapped.operation) : undefined,
      validationErrors: mapped.ok ? undefined : requiredJson(mapped.errors),
    };
  });
  const validRows = rows.filter((row) => row.status === "valid").length;
  await prisma.$transaction(async (transaction) => {
    await transaction.importBatchRow.deleteMany({ where: { batchId: job.batch!.id } });
    for (let offset = 0; offset < rows.length; offset += 500) {
      await transaction.importBatchRow.createMany({ data: rows.slice(offset, offset + 500) });
    }
    await transaction.importBatch.update({
      where: { id: job.batch!.id },
      data: {
        status: "ready",
        validRows,
        invalidRows: rows.length - validRows,
        processedRows: 0,
        failedRows: 0,
      },
    });
  });
}

async function processImportBatch(backgroundJobId: string): Promise<void> {
  const job = await prisma.backgroundJob.findUniqueOrThrow({
    where: { id: backgroundJobId },
    include: { batch: { include: { organization: true } } },
  });
  if (!job.batch) throw new UnrecoverableError("Import processing job has no batch.");
  let processedRows = job.batch.processedRows;
  let failedRows = job.batch.failedRows;
  while (true) {
    const rows = await prisma.importBatchRow.findMany({
      where: { batchId: job.batch.id, status: "valid" },
      orderBy: { rowNumber: "asc" },
      take: 100,
    });
    if (!rows.length) break;
    for (const row of rows) {
      try {
        await calculateTax({
          actorUserId: job.createdById,
          tenant: {
            id: job.organizationId,
            segment: job.batch.organization.segment,
          },
          operation: decodeImportedOperation(row.normalizedInput),
          source: { kind: "import_row", rowId: row.id },
        });
        processedRows += 1;
      } catch (error) {
        failedRows += 1;
        await prisma.importBatchRow.updateMany({
          where: { id: row.id, status: "valid" },
          data: {
            status: "failed",
            validationErrors: requiredJson([
              {
                field: "row",
                code: "calculation_failed",
                message: error instanceof Error ? error.message : "Falha inesperada no cálculo.",
              },
            ]),
          },
        });
      }
    }
    await prisma.$transaction([
      prisma.importBatch.update({
        where: { id: job.batch.id },
        data: { processedRows, failedRows },
      }),
      prisma.backgroundJob.update({
        where: { id: backgroundJobId },
        data: { progressCurrent: processedRows + failedRows },
      }),
    ]);
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.importBatch.update({
      where: { id: job.batch!.id },
      data: { status: "requires_review", processedRows, failedRows },
    });
    await transaction.notification.create({
      data: {
        id: uuidv7(),
        organizationId: job.organizationId,
        userId: job.createdById,
        type: "batch_requires_review",
        title: "Lote pronto para revisão",
        message: `${processedRows} linha(s) calculada(s) e ${failedRows} falha(s).`,
        entityType: "ImportBatch",
        entityId: job.batch!.id,
      },
    });
  });
}

async function generateCalculationExport(backgroundJobId: string): Promise<void> {
  const job = await prisma.backgroundJob.findUniqueOrThrow({
    where: { id: backgroundJobId },
    include: { export: true },
  });
  if (!job.export) {
    throw new UnrecoverableError("Export job has no artifact.");
  }
  const payload = job.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new UnrecoverableError("Export job payload is invalid.");
  }
  let columns;
  let filters;
  let options;
  try {
    columns = decodeCalculationExportColumns(job.export.columns);
    filters = decodeCalculationExportFilters(job.export.filters);
    options = decodeCalculationExportOptions(payload.options);
  } catch (error) {
    throw new UnrecoverableError(
      error instanceof Error ? error.message : "Export configuration is invalid.",
    );
  }

  const records = [];
  let cursor;
  do {
    const page = await calculationLedger.list(job.organizationId, {
      ...filters,
      limit: 500,
      cursor,
    });
    records.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  const generatedAt = new Date().toISOString();
  const isCsv = job.export.format === "csv";
  const extension = isCsv ? "csv" : "json";
  const contentType = isCsv
    ? "text/csv; charset=utf-8"
    : "application/json; charset=utf-8";
  const fileName = `taxman-calculos-${job.export.id}.${extension}`;
  const objectKey = tenantObjectKey({
    tenantId: job.organizationId,
    category: isCsv ? "exports" : "evidence",
    objectId: job.export.id,
    extension,
  });
  const content = isCsv
    ? renderCalculationCsv({ records, columns, delimiter: options.delimiter })
    : renderCalculationEvidence({ records, generatedAt });
  await storage.put({
    key: objectKey,
    bytes: new TextEncoder().encode(content),
    contentType,
    metadata: { exportId: job.export.id, tenantId: job.organizationId },
  });
  await prisma.$transaction(async (transaction) => {
    await transaction.exportArtifact.update({
      where: { id: job.export!.id },
      data: {
        status: "ready",
        objectKey,
        fileName,
        contentType,
        rowCount: records.length,
        errorMessage: null,
        readyAt: new Date(generatedAt),
      },
    });
    await transaction.backgroundJob.update({
      where: { id: backgroundJobId },
      data: { progressCurrent: records.length, progressTotal: records.length },
    });
    await transaction.notification.create({
      data: {
        id: uuidv7(),
        organizationId: job.organizationId,
        userId: job.createdById,
        type: "export_ready",
        title: "Exportação pronta",
        message: `${records.length} cálculo(s) disponível(is) para download.`,
        entityType: "ExportArtifact",
        entityId: job.export!.id,
      },
    });
    await transaction.auditLog.create({
      data: {
        id: uuidv7(),
        actorUserId: job.createdById,
        organizationId: job.organizationId,
        action: "calculation_export.generated",
        entityType: "ExportArtifact",
        entityId: job.export!.id,
        after: requiredJson({
          format: job.export!.format,
          rowCount: records.length,
          generatedAt,
        }),
      },
    });
  });
}

async function beginTrackedAttempt(backgroundJobId: string) {
  return prisma.$transaction(async (transaction) => {
    const job = await transaction.backgroundJob.findUniqueOrThrow({
      where: { id: backgroundJobId },
    });
    if (job.status !== "queued" && job.status !== "retrying") {
      throw new UnrecoverableError(`Background job cannot start from ${job.status}.`);
    }
    const number = job.attemptsMade + 1;
    if (number > job.maxAttempts) throw new UnrecoverableError("Attempt limit reached.");
    await transaction.backgroundJob.update({
      where: { id: job.id },
      data: { status: "active", attemptsMade: number, startedAt: new Date() },
    });
    const attemptId = uuidv7();
    await transaction.jobAttempt.create({
      data: {
        id: attemptId,
        jobId: job.id,
        number,
        status: "active",
        correlationId: uuidv7(),
      },
    });
    return { job, attemptId, number };
  });
}

async function runTrackedJob(backgroundJobId: string, handler: () => Promise<void>) {
  const tracked = await beginTrackedAttempt(backgroundJobId);
  try {
    await handler();
    await prisma.$transaction([
      prisma.jobAttempt.update({
        where: { id: tracked.attemptId },
        data: { status: "completed", finishedAt: new Date() },
      }),
      prisma.backgroundJob.update({
        where: { id: backgroundJobId },
        data: { status: "completed", finishedAt: new Date() },
      }),
    ]);
  } catch (error) {
    const finalFailure =
      error instanceof UnrecoverableError ||
      tracked.number >= tracked.job.maxAttempts;
    const message = error instanceof Error ? error.message : "Unknown background job failure";
    await prisma.$transaction(async (transaction) => {
      await transaction.jobAttempt.update({
        where: { id: tracked.attemptId },
        data: { status: "failed", finishedAt: new Date(), errorCode: "job_failed", errorMessage: message },
      });
      await transaction.backgroundJob.update({
        where: { id: backgroundJobId },
        data: {
          status: finalFailure ? "failed" : "retrying",
          finishedAt: finalFailure ? new Date() : null,
          lastErrorCode: "job_failed",
          lastErrorMessage: message,
        },
      });
      if (finalFailure) {
        if (tracked.job.batchId) {
          await transaction.importBatch.update({ where: { id: tracked.job.batchId }, data: { status: "failed" } });
        }
        if (tracked.job.exportId) {
          await transaction.exportArtifact.update({
            where: { id: tracked.job.exportId },
            data: {
              status: "failed",
              objectKey: null,
              fileName: null,
              contentType: null,
              rowCount: 0,
              readyAt: null,
              errorMessage: message,
            },
          });
        }
        await transaction.notification.create({
          data: {
            id: uuidv7(),
            organizationId: tracked.job.organizationId,
            userId: tracked.job.createdById,
            type: "job_failed",
            title: "Falha no processamento",
            message: "O job esgotou as tentativas automáticas. Consulte os detalhes para tentar novamente.",
            entityType: "BackgroundJob",
            entityId: backgroundJobId,
          },
        });
      }
    });
    throw error;
  }
}

async function processJob(job: TaxmanJob): Promise<void> {
  if (job.name === activationJobName) {
    await recordScheduledRuleActivations(prisma);
    return;
  }
  if (job.name === "jobs.dispatch-pending") {
    await dispatchPendingJobs();
    return;
  }
  const backgroundJobId = job.data.backgroundJobId;
  if (typeof backgroundJobId !== "string") {
    throw new UnrecoverableError(`Missing background job id for ${job.name}.`);
  }
  if (job.name === "imports.validate") {
    await runTrackedJob(backgroundJobId, () => validateImportBatch(backgroundJobId));
    return;
  }
  if (job.name === "imports.process") {
    await runTrackedJob(backgroundJobId, () => processImportBatch(backgroundJobId));
    return;
  }
  if (job.name === "exports.generate") {
    await runTrackedJob(backgroundJobId, () =>
      generateCalculationExport(backgroundJobId),
    );
    return;
  }
  throw new UnrecoverableError(`Unsupported job type: ${job.name}`);
}

const worker = createTaxmanWorker(processJob);
worker.on("completed", (job) => {
  console.info("background_job_completed", { jobId: job.id, type: job.name });
});
worker.on("failed", (job, error) => {
  console.error("background_job_failed", {
    jobId: job?.id,
    type: job?.name,
    errorName: error.name,
    message: error.message,
  });
});
worker.on("error", (error) => {
  console.error("background_worker_error", {
    errorName: error.name,
    message: error.message,
  });
});

async function shutdown(signal: string): Promise<void> {
  console.info("background_worker_stopping", { signal });
  await worker.close();
  await queue.close();
  await Promise.all([
    storageClient.destroy(),
    prisma.$disconnect(),
  ]);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(() => process.exit(0));
  });
}

console.info("background_worker_ready", {
  queue: queue.name,
  storageBucket: storageConfig.bucket,
});
