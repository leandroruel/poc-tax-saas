-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('in_force', 'contested', 'needs_review');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "version" INTEGER NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "rateUnit" TEXT NOT NULL,
    "additionalRate" DECIMAL(65,30),
    "additionalRateUnit" TEXT,
    "baseRule" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "exceptions" JSONB NOT NULL,
    "status" "RuleStatus" NOT NULL DEFAULT 'needs_review',
    "createdBy" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantContext" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exceptions" JSONB NOT NULL,
    "regimes" JSONB NOT NULL,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "classifiedType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calculation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "results" JSONB NOT NULL,
    "explanation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRule_taxType_operationType_effectiveFrom_effectiveTo_idx" ON "TaxRule"("taxType", "operationType", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "TenantContext_tenantId_idx" ON "TenantContext"("tenantId");

-- CreateIndex
CREATE INDEX "Operation_tenantId_idx" ON "Operation"("tenantId");

-- CreateIndex
CREATE INDEX "Calculation_operationId_idx" ON "Calculation"("operationId");

-- AddForeignKey
ALTER TABLE "TenantContext" ADD CONSTRAINT "TenantContext_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
