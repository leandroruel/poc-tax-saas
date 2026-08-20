import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  createCalculateTax,
  type CalculateTax,
} from "../../application/calculate-tax.js";
import type { AuthenticateRequest } from "../../application/ports/authenticator.js";
import type { AuthenticateUser } from "../../application/ports/user-authenticator.js";
import type { RuleAdministration } from "../../application/ports/rule-administration.js";
import type { TenantQueries } from "../../application/ports/tenant-queries.js";
import {
  createOnboardCompany,
  type OnboardCompany,
} from "../../application/onboard-company.js";
import { createPrismaCalculationJournal } from "../../infrastructure/prisma/calculation-journal.js";
import { prisma } from "../../infrastructure/prisma/prisma-client.js";
import { createPrismaRuleCatalog } from "../../infrastructure/prisma/rule-catalog.js";
import {
  authenticateUserWithBetterAuth,
  authenticateWithBetterAuth,
} from "../../infrastructure/auth/better-auth-authenticator.js";
import { createPrismaOnboardingStore } from "../../infrastructure/prisma/onboarding-store.js";
import { createPrismaRuleAdministration } from "../../infrastructure/prisma/rule-administration.js";
import { createPrismaTenantQueries } from "../../infrastructure/prisma/tenant-queries.js";
import { recordScheduledRuleActivations } from "../../infrastructure/prisma/scheduled-rule-activation.js";
import { createEnvironmentTaxIdVault } from "../../infrastructure/security/tax-id-vault.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerAdminRuleRoutes } from "./routes/admin-rule.routes.js";
import { registerTenantRoutes } from "./routes/tenant.routes.js";
import { registerOnboardingRoutes } from "./routes/onboarding.routes.js";
import { registerTaxRoutes } from "./routes/tax.routes.js";

interface ServerDependencies {
  readonly authenticate: AuthenticateRequest;
  readonly authenticateUser: AuthenticateUser;
  readonly calculateTax: CalculateTax;
  readonly onboardCompany: OnboardCompany;
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
    calculateTax:
      overrides.calculateTax ??
      createCalculateTax({
        ruleCatalog: createPrismaRuleCatalog(prisma),
        calculationJournal: createPrismaCalculationJournal(prisma),
      }),
    onboardCompany:
      overrides.onboardCompany ??
      createOnboardCompany({
        store: createPrismaOnboardingStore(prisma),
        taxIdVault: createEnvironmentTaxIdVault(),
      }),
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
  );
  registerOnboardingRoutes(
    app,
    dependencies.authenticateUser,
    dependencies.onboardCompany,
  );
  registerTaxRoutes(app, dependencies.calculateTax, dependencies.authenticate);

  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3000);
  let activationTimer: NodeJS.Timeout | undefined;
  app.addHook("onClose", async () => {
    if (activationTimer) clearInterval(activationTimer);
  });
  await app.listen({ port, host: "0.0.0.0" });
  const recordActivations = () =>
    recordScheduledRuleActivations(prisma).catch((error) =>
      app.log.error(error),
    );
  await recordActivations();
  activationTimer = setInterval(recordActivations, 60_000);
  activationTimer.unref();
}
