import Fastify from "fastify";
import cors from "@fastify/cors";
import { createCalculateTax } from "../../application/calculate-tax.js";
import { createPrismaCalculationJournal } from "../../infrastructure/prisma/calculation-journal.js";
import { prisma } from "../../infrastructure/prisma/prisma-client.js";
import { createPrismaRuleCatalog } from "../../infrastructure/prisma/rule-catalog.js";
import { registerTaxRoutes } from "./routes/tax.routes.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors);

  const calculateTax = createCalculateTax({
    ruleCatalog: createPrismaRuleCatalog(prisma),
    calculationJournal: createPrismaCalculationJournal(prisma),
  });

  app.get("/health", async () => ({ status: "ok" }));

  registerTaxRoutes(app, calculateTax);

  return app;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
}
