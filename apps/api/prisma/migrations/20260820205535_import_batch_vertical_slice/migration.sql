-- CreateEnum
CREATE TYPE "ImportBatchRowStatus" AS ENUM ('valid', 'invalid', 'processed', 'failed');

-- AlterTable
ALTER TABLE "BackgroundJob" ADD COLUMN     "dispatchVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "delimiter" TEXT,
ADD COLUMN     "detectedHeaders" JSONB,
ADD COLUMN     "mapping" JSONB,
ADD COLUMN     "mappingProfileId" TEXT,
ADD COLUMN     "operationType" TEXT;

-- CreateTable
CREATE TABLE "ImportMappingProfile" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMappingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatchRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportBatchRowStatus" NOT NULL,
    "rawData" JSONB NOT NULL,
    "normalizedInput" JSONB,
    "validationErrors" JSONB,
    "calculationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatchRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportMappingProfile_createdById_idx" ON "ImportMappingProfile"("createdById");

-- CreateIndex
CREATE INDEX "ImportMappingProfile_organizationId_operationType_updatedAt_idx" ON "ImportMappingProfile"("organizationId", "operationType", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ImportMappingProfile_organizationId_name_key" ON "ImportMappingProfile"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatchRow_calculationId_key" ON "ImportBatchRow"("calculationId");

-- CreateIndex
CREATE INDEX "ImportBatchRow_batchId_status_rowNumber_idx" ON "ImportBatchRow"("batchId", "status", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatchRow_batchId_rowNumber_key" ON "ImportBatchRow"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "ImportBatch_mappingProfileId_idx" ON "ImportBatch"("mappingProfileId");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_mappingProfileId_fkey" FOREIGN KEY ("mappingProfileId") REFERENCES "ImportMappingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMappingProfile" ADD CONSTRAINT "ImportMappingProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMappingProfile" ADD CONSTRAINT "ImportMappingProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatchRow" ADD CONSTRAINT "ImportBatchRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatchRow" ADD CONSTRAINT "ImportBatchRow_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "Calculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BackgroundJob"
ADD CONSTRAINT "BackgroundJob_dispatchVersion_check"
CHECK ("dispatchVersion" >= 0);

ALTER TABLE "ImportBatch"
ADD CONSTRAINT "ImportBatch_operationType_check"
CHECK (
  "operationType" IS NULL OR
  "operationType" IN ('credit_pj_principal_defined', 'insurance_vgbl')
),
ADD CONSTRAINT "ImportBatch_delimiter_check"
CHECK ("delimiter" IS NULL OR "delimiter" IN (',', ';', E'\t'));

ALTER TABLE "ImportMappingProfile"
ADD CONSTRAINT "ImportMappingProfile_operationType_check"
CHECK ("operationType" IN ('credit_pj_principal_defined', 'insurance_vgbl')),
ADD CONSTRAINT "ImportMappingProfile_name_check"
CHECK (char_length(btrim("name")) BETWEEN 1 AND 80);

ALTER TABLE "ImportBatchRow"
ADD CONSTRAINT "ImportBatchRow_number_check" CHECK ("rowNumber" >= 2),
ADD CONSTRAINT "ImportBatchRow_evidence_check"
CHECK (
  ("status" = 'valid' AND "normalizedInput" IS NOT NULL AND "validationErrors" IS NULL AND "calculationId" IS NULL) OR
  ("status" = 'invalid' AND "normalizedInput" IS NULL AND "validationErrors" IS NOT NULL AND "calculationId" IS NULL) OR
  ("status" = 'processed' AND "normalizedInput" IS NOT NULL AND "validationErrors" IS NULL AND "calculationId" IS NOT NULL) OR
  ("status" = 'failed' AND "normalizedInput" IS NOT NULL AND "validationErrors" IS NOT NULL AND "calculationId" IS NULL)
);
