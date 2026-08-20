import { UnrecoverableError } from "bullmq";
import { v7 as uuidv7 } from "uuid";
import { parseCsv } from "../../domain/operations/csv.js";
import { mapImportedRow, type ImportMapping } from "../../domain/operations/import-mapping.js";
import { jsonValue } from "../../infrastructure/prisma/json.js";
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

const activationJobName = "rules.activate-due";
const storageConfig = objectStorageConfigFromEnvironment();
const storageClient = createS3Client(storageConfig);
const storage = createS3ObjectStorage(storageClient, storageConfig.bucket);
await assertS3BucketReady(storageClient, storageConfig.bucket);

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
        data: { status: "completed", finishedAt: new Date(), progressCurrent: 1, progressTotal: 1 },
      }),
    ]);
  } catch (error) {
    const finalFailure = tracked.number >= tracked.job.maxAttempts;
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
