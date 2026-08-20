-- CreateEnum
CREATE TYPE "ExportArtifactStatus" AS ENUM ('queued', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "ExportArtifactFormat" AS ENUM ('csv', 'evidence_json');

-- AlterTable
ALTER TABLE "BackgroundJob" ADD COLUMN     "exportId" TEXT;

-- CreateTable
CREATE TABLE "ExportArtifact" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ExportArtifactStatus" NOT NULL DEFAULT 'queued',
    "format" "ExportArtifactFormat" NOT NULL,
    "columns" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "objectKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "ExportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExportArtifact_objectKey_key" ON "ExportArtifact"("objectKey");

-- CreateIndex
CREATE INDEX "ExportArtifact_organizationId_createdAt_id_idx" ON "ExportArtifact"("organizationId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ExportArtifact_createdById_idx" ON "ExportArtifact"("createdById");

-- CreateIndex
CREATE INDEX "ExportArtifact_status_updatedAt_idx" ON "ExportArtifact"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_exportId_idx" ON "BackgroundJob"("exportId");

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "ExportArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportArtifact" ADD CONSTRAINT "ExportArtifact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportArtifact" ADD CONSTRAINT "ExportArtifact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Export metadata is part of the audit trail. Keep lifecycle transitions and
-- user-configured JSON structurally coherent even for non-application writers.
ALTER TABLE "ExportArtifact"
ADD CONSTRAINT "ExportArtifact_rowCount_check"
CHECK ("rowCount" >= 0),
ADD CONSTRAINT "ExportArtifact_columns_check"
CHECK (jsonb_typeof("columns") = 'array' AND jsonb_array_length("columns") > 0),
ADD CONSTRAINT "ExportArtifact_filters_check"
CHECK (jsonb_typeof("filters") = 'object'),
ADD CONSTRAINT "ExportArtifact_lifecycle_check"
CHECK (
  (
    "status" = 'queued' AND
    "objectKey" IS NULL AND
    "fileName" IS NULL AND
    "contentType" IS NULL AND
    "readyAt" IS NULL AND
    "errorMessage" IS NULL AND
    "rowCount" = 0
  ) OR
  (
    "status" = 'ready' AND
    "objectKey" IS NOT NULL AND
    "fileName" IS NOT NULL AND
    "contentType" IS NOT NULL AND
    "readyAt" IS NOT NULL AND
    "errorMessage" IS NULL
  ) OR
  (
    "status" = 'failed' AND
    "objectKey" IS NULL AND
    "contentType" IS NULL AND
    "readyAt" IS NULL AND
    "errorMessage" IS NOT NULL
  )
);

-- A background job belongs to at most one aggregate workflow.
ALTER TABLE "BackgroundJob"
ADD CONSTRAINT "BackgroundJob_single_parent_check"
CHECK (NOT ("batchId" IS NOT NULL AND "exportId" IS NOT NULL));
