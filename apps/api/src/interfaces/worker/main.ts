import { UnrecoverableError } from "bullmq";
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
  objectStorageConfigFromEnvironment,
} from "../../infrastructure/storage/s3-object-storage.js";

const activationJobName = "rules.activate-due";
const storageConfig = objectStorageConfigFromEnvironment();
const storageClient = createS3Client(storageConfig);
await assertS3BucketReady(storageClient, storageConfig.bucket);

const queue = createTaxmanQueue();
await queue.upsertJobScheduler(
  "activate-due-rules-every-minute",
  { every: 60_000 },
  { name: activationJobName, data: {} },
);

async function processJob(job: TaxmanJob): Promise<void> {
  if (job.name === activationJobName) {
    await recordScheduledRuleActivations(prisma);
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
