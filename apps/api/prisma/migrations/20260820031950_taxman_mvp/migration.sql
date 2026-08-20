/*
  Warnings:

  - You are about to drop the column `asOfDate` on the `Calculation` table. All the data in the column will be lost.
  - You are about to drop the column `operationId` on the `Calculation` table. All the data in the column will be lost.
  - You are about to drop the column `additionalRate` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `additionalRateUnit` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `basePolicy` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `baseRule` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `conditions` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `effectiveFrom` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `effectiveTo` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `legalBasis` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `rate` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `rateUnit` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedBy` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `TaxRule` table. All the data in the column will be lost.
  - You are about to drop the `Operation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tenant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TenantContext` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[code]` on the table `TaxRule` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdById` to the `Calculation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `input` to the `Calculation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `occurredOn` to the `Calculation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operationType` to the `Calculation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `Calculation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `TaxRule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TenantSegment" AS ENUM ('credit_provider', 'insurance_pension');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('user', 'super_admin');

-- CreateEnum
CREATE TYPE "RuleEditorialStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'revoked');

-- The previous tables contain disposable POC data whose shape is incompatible
-- with the audited MVP aggregate. They are intentionally rebuilt instead of
-- manufacturing incomplete audit identities or rule snapshots.
DROP TABLE "Calculation";
DROP TABLE "Operation";
DROP TABLE "TenantContext";
DROP TABLE "Tenant";
DROP TABLE "TaxRule";
DROP TYPE "RuleStatus";

CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "taxType" TEXT NOT NULL DEFAULT 'IOF',
    "operationType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Calculation" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "occurredOn" DATE NOT NULL,
    "input" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "ruleVersionId" TEXT,
    "ruleSnapshot" JSONB,
    "recalculatesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Calculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" UUID,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" TEXT,
    "taxId" TEXT NOT NULL,
    "segment" "TenantSegment" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "taxIdCiphertext" TEXT NOT NULL,
    "taxIdIv" TEXT NOT NULL,
    "taxIdAuthTag" TEXT NOT NULL,
    "taxIdBlindIndex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TaxRuleVersion" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "editorialStatus" "RuleEditorialStatus" NOT NULL DEFAULT 'draft',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "treatment" JSONB NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "organizationId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_activeOrganizationId_idx" ON "Session"("activeOrganizationId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_taxId_key" ON "Organization"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_userId_key" ON "Member"("userId");

-- CreateIndex
CREATE INDEX "Member_organizationId_idx" ON "Member"("organizationId");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_taxIdBlindIndex_key" ON "UserProfile"("taxIdBlindIndex");

-- CreateIndex
CREATE INDEX "TaxRuleVersion_editorialStatus_effectiveFrom_effectiveTo_idx" ON "TaxRuleVersion"("editorialStatus", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRuleVersion_ruleId_version_key" ON "TaxRuleVersion"("ruleId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_occurredAt_idx" ON "AuditLog"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_occurredAt_idx" ON "AuditLog"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "Calculation_organizationId_createdAt_idx" ON "Calculation"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Calculation_createdById_idx" ON "Calculation"("createdById");

-- CreateIndex
CREATE INDEX "Calculation_ruleVersionId_idx" ON "Calculation"("ruleVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_code_key" ON "TaxRule"("code");

-- CreateIndex
CREATE INDEX "TaxRule_taxType_operationType_idx" ON "TaxRule"("taxType", "operationType");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRuleVersion" ADD CONSTRAINT "TaxRuleVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "TaxRuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_recalculatesId_fkey" FOREIGN KEY ("recalculatesId") REFERENCES "Calculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
