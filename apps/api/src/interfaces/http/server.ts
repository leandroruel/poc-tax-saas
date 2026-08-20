import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import {
  createImportBatchWorkflow,
  type ImportBatchWorkflow,
} from "../../application/import-batches.js";
import {
  createCalculateTax,
  type CalculateTax,
} from "../../application/calculate-tax.js";
import type { AuthenticateRequest } from "../../application/ports/authenticator.js";
import type { CalculationLedger } from "../../application/ports/calculation-ledger.js";
import type { AuthenticateUser } from "../../application/ports/user-authenticator.js";
import type { RuleAdministration } from "../../application/ports/rule-administration.js";
import type { BackgroundJobOperations } from "../../application/ports/background-job-operations.js";
import type { OperationalQueries } from "../../application/ports/operational-queries.js";
import type { TenantQueries } from "../../application/ports/tenant-queries.js";
import {
  createCalculationExportWorkflow,
  type CalculationExportWorkflow,
} from "../../application/calculation-exports.js";
import {
  createOnboardCompany,
  type OnboardCompany,
} from "../../application/onboard-company.js";
import { createPrismaCalculationJournal } from "../../infrastructure/prisma/calculation-journal.js";
import { createPrismaCalculationExportRepository } from "../../infrastructure/prisma/calculation-export-repository.js";
import { createPrismaCalculationLedger } from "../../infrastructure/prisma/calculation-ledger.js";
import { prisma } from "../../infrastructure/prisma/prisma-client.js";
import { createPrismaRuleCatalog } from "../../infrastructure/prisma/rule-catalog.js";
import {
  authenticateUserWithBetterAuth,
  authenticateWithBetterAuth,
} from "../../infrastructure/auth/better-auth-authenticator.js";
import { createPrismaOnboardingStore } from "../../infrastructure/prisma/onboarding-store.js";
import { createPrismaOperationalQueries } from "../../infrastructure/prisma/operational-queries.js";
import { createPrismaBackgroundJobOperations } from "../../infrastructure/prisma/background-job-operations.js";
import { createPrismaImportBatchRepository } from "../../infrastructure/prisma/import-batch-repository.js";
import { createPrismaRuleAdministration } from "../../infrastructure/prisma/rule-administration.js";
import { createPrismaTenantQueries } from "../../infrastructure/prisma/tenant-queries.js";
import { createEnvironmentTaxIdVault } from "../../infrastructure/security/tax-id-vault.js";
import { createEnvironmentS3ObjectStorage } from "../../infrastructure/storage/s3-object-storage.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerAdminRuleRoutes } from "./routes/admin-rule.routes.js";
import { registerTenantRoutes } from "./routes/tenant.routes.js";
import { registerOnboardingRoutes } from "./routes/onboarding.routes.js";
import { registerOperationsRoutes } from "./routes/operations.routes.js";
import { registerImportBatchRoutes } from "./routes/import-batch.routes.js";
import { registerTaxRoutes } from "./routes/tax.routes.js";
import { registerCalculationExportRoutes } from "./routes/calculation-export.routes.js";

interface ServerDependencies {
  readonly authenticate: AuthenticateRequest;
  readonly authenticateUser: AuthenticateUser;
  readonly calculationLedger: CalculationLedger;
  readonly calculateTax: CalculateTax;
  readonly calculationExports: CalculationExportWorkflow;
  readonly importBatches: ImportBatchWorkflow;
  readonly jobOperations: BackgroundJobOperations;
  readonly onboardCompany: OnboardCompany;
  readonly operationalQueries: OperationalQueries;
  readonly ruleAdministration: RuleAdministration;
  readonly tenantQueries: TenantQueries;
}

function createProductionDependencies(
  overrides: Partial<ServerDependencies>,
): ServerDependencies {
  return {
    authenticate: overrides.authenticate ?? authenticateWithBetterAuth,
    authenticateUser:
      overrides.authenticateUser ?? authenticateUserWithBetterAuth,
    calculationLedger:
      overrides.calculationLedger ?? createPrismaCalculationLedger(prisma),
    calculateTax:
      overrides.calculateTax ??
      createCalculateTax({
        ruleCatalog: createPrismaRuleCatalog(prisma),
        calculationJournal: createPrismaCalculationJournal(prisma),
      }),
    calculationExports:
      overrides.calculationExports ??
      createCalculationExportWorkflow({
        repository: createPrismaCalculationExportRepository(prisma),
        storage: createEnvironmentS3ObjectStorage(),
      }),
    importBatches:
      overrides.importBatches ??
      createImportBatchWorkflow({
        repository: createPrismaImportBatchRepository(prisma),
        storage: createEnvironmentS3ObjectStorage(),
      }),
    jobOperations:
      overrides.jobOperations ?? createPrismaBackgroundJobOperations(prisma),
    onboardCompany:
      overrides.onboardCompany ??
      createOnboardCompany({
        store: createPrismaOnboardingStore(prisma),
        taxIdVault: createEnvironmentTaxIdVault(),
      }),
    operationalQueries:
      overrides.operationalQueries ?? createPrismaOperationalQueries(prisma),
    ruleAdministration:
      overrides.ruleAdministration ?? createPrismaRuleAdministration(prisma),
    tenantQueries:
      overrides.tenantQueries ?? createPrismaTenantQueries(prisma),
  };
}

export async function buildServer(overrides: Partial<ServerDependencies> = {}) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.APP_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  });
  await app.register(multipart, {
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
  });

  const dependencies = createProductionDependencies(overrides);

  app.get("/health", async () => ({ status: "ok" }));

  registerAuthRoutes(app);
  registerAdminRuleRoutes(
    app,
    dependencies.authenticateUser,
    dependencies.ruleAdministration,
  );
  registerTenantRoutes(
    app,
    dependencies.authenticate,
    dependencies.authenticateUser,
    dependencies.tenantQueries,
    dependencies.calculationLedger,
  );
  registerOnboardingRoutes(
    app,
    dependencies.authenticateUser,
    dependencies.onboardCompany,
  );
  registerOperationsRoutes(
    app,
    dependencies.authenticate,
    dependencies.operationalQueries,
    dependencies.jobOperations,
  );
  registerImportBatchRoutes(
    app,
    dependencies.authenticate,
    dependencies.importBatches,
  );
  registerCalculationExportRoutes(
    app,
    dependencies.authenticate,
    dependencies.calculationExports,
  );
  registerTaxRoutes(app, dependencies.calculateTax, dependencies.authenticate);

  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
}
