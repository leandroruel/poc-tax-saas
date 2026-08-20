-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('draft', 'validating', 'ready', 'processing', 'requires_review', 'closed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('queued', 'active', 'retrying', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "JobAttemptStatus" AS ENUM ('active', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('batch_completed', 'batch_requires_review', 'job_failed', 'job_recovered', 'export_ready', 'rule_scheduled', 'rule_activated');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'draft',
    "sourceKind" TEXT NOT NULL DEFAULT 'manual_upload',
    "originalFileName" TEXT,
    "objectKey" TEXT,
    "contentHash" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" TEXT NOT NULL,
    "batchId" TEXT,
    "type" TEXT NOT NULL,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'queued',
    "payload" JSONB NOT NULL,
    "progressCurrent" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "attemptsMade" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "correlationId" TEXT NOT NULL,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "JobAttemptStatus" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "JobAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_organizationId_createdAt_id_idx" ON "ImportBatch"("organizationId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ImportBatch_createdById_idx" ON "ImportBatch"("createdById");

-- CreateIndex
CREATE INDEX "ImportBatch_status_updatedAt_idx" ON "ImportBatch"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_correlationId_key" ON "BackgroundJob"("correlationId");

-- CreateIndex
CREATE INDEX "BackgroundJob_organizationId_createdAt_id_idx" ON "BackgroundJob"("organizationId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "BackgroundJob_createdById_idx" ON "BackgroundJob"("createdById");

-- CreateIndex
CREATE INDEX "BackgroundJob_batchId_idx" ON "BackgroundJob"("batchId");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_updatedAt_idx" ON "BackgroundJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "JobAttempt_jobId_startedAt_idx" ON "JobAttempt"("jobId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobAttempt_jobId_number_key" ON "JobAttempt"("jobId", "number");

-- CreateIndex
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttempt" ADD CONSTRAINT "JobAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackgroundJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Progress and row counters are financial workflow evidence. Invalid negative
-- or over-complete values must be rejected even for non-application writers.
ALTER TABLE "ImportBatch"
ADD CONSTRAINT "ImportBatch_nonnegative_counters_check"
CHECK (
  "totalRows" >= 0 AND
  "validRows" >= 0 AND
  "invalidRows" >= 0 AND
  "processedRows" >= 0 AND
  "failedRows" >= 0 AND
  "validRows" + "invalidRows" <= "totalRows" AND
  "processedRows" + "failedRows" <= "validRows"
);

ALTER TABLE "BackgroundJob"
ADD CONSTRAINT "BackgroundJob_progress_check"
CHECK (
  "progressCurrent" >= 0 AND
  "progressTotal" >= 0 AND
  "progressCurrent" <= "progressTotal" AND
  "attemptsMade" >= 0 AND
  "maxAttempts" BETWEEN 1 AND 20 AND
  "attemptsMade" <= "maxAttempts"
);

ALTER TABLE "JobAttempt"
ADD CONSTRAINT "JobAttempt_number_check" CHECK ("number" > 0);

-- Re-uploading byte-identical input for the same tenant is a duplicate, while
-- the same file may legitimately exist in another tenant.
CREATE UNIQUE INDEX "ImportBatch_organizationId_contentHash_unique"
ON "ImportBatch" ("organizationId", "contentHash")
WHERE "contentHash" IS NOT NULL;

CREATE UNIQUE INDEX "ImportBatch_objectKey_unique"
ON "ImportBatch" ("objectKey")
WHERE "objectKey" IS NOT NULL;
