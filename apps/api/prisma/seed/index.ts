import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { auth } from "../../src/infrastructure/auth/auth.js";
import { prisma } from "../../src/infrastructure/prisma/prisma-client.js";

const adminEmail = process.env.TAXMAN_ADMIN_EMAIL ?? "admin@taxman.local";
const adminPassword = process.env.TAXMAN_ADMIN_PASSWORD;
if (!adminPassword) {
  throw new Error(
    "TAXMAN_ADMIN_PASSWORD is required to seed the platform administrator.",
  );
}
const planaltoSource =
  "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm";
const suspensionSource =
  "https://noticias.stf.jus.br/postsnoticias/decisao-que-restabeleceu-aumento-do-iof-nao-alcanca-periodo-de-suspensao-esclarece-stf/";
const vgblSource =
  "https://www.gov.br/susep/pt-br/central-de-conteudos/noticias/2025/junho/novo-decreto-atualiza-regra-de-iof-para-planos-vgbl";

interface SeedVersion {
  id: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  treatment: Prisma.InputJsonObject;
  legalBasis: string;
  sourceUrl: string;
  changeReason: string;
}

interface SeedRule {
  id: string;
  code: string;
  operationType: "credit_pj_principal_defined" | "insurance_vgbl";
  versions: SeedVersion[];
}

function creditTreatment(dailyPercentage: string): Prisma.InputJsonObject {
  return {
    kind: "rate",
    rate: { percentage: dailyPercentage, unit: "daily_percent" },
    additionalRate: { percentage: "0.38", unit: "percent" },
    basePolicy: { kind: "full_amount" },
  };
}

function vgblTreatment(
  scope: "same_insurer" | "all_insurers",
  threshold: string,
): Prisma.InputJsonObject {
  return {
    kind: "rate",
    rate: { percentage: "5", unit: "percent" },
    basePolicy: { kind: "aggregate_threshold", scope, threshold },
  };
}

const rules: SeedRule[] = [
  {
    id: "iof-credit-pj-principal-defined",
    code: "IOF_CREDIT_PJ_PRINCIPAL_DEFINED",
    operationType: "credit_pj_principal_defined",
    versions: [
      {
        id: "iof-credit-pj-v1",
        version: 1,
        effectiveFrom: "2025-01-01",
        effectiveTo: "2025-06-11",
        treatment: creditTreatment("0.0041"),
        legalBasis: "Decreto 6.306/2007, art. 7º, I, § 1º e § 15",
        sourceUrl: planaltoSource,
        changeReason: "Regra anterior ao Decreto 12.499/2025.",
      },
      {
        id: "iof-credit-pj-v2",
        version: 2,
        effectiveFrom: "2025-06-11",
        effectiveTo: "2025-06-27",
        treatment: creditTreatment("0.0082"),
        legalBasis: "Decreto 6.306/2007, art. 7º, I, § 1º e § 15",
        sourceUrl: planaltoSource,
        changeReason: "Majoração introduzida pelo Decreto 12.499/2025.",
      },
      {
        id: "iof-credit-pj-v3",
        version: 3,
        effectiveFrom: "2025-06-27",
        effectiveTo: "2025-07-17",
        treatment: creditTreatment("0.0041"),
        legalBasis:
          "Decreto 6.306/2007 e período de suspensão do Decreto 12.499/2025",
        sourceUrl: suspensionSource,
        changeReason:
          "Operações no período de suspensão não recebem a majoração.",
      },
      {
        id: "iof-credit-pj-v4",
        version: 4,
        effectiveFrom: "2025-07-17",
        effectiveTo: null,
        treatment: creditTreatment("0.0082"),
        legalBasis: "Decreto 6.306/2007, art. 7º, I, § 1º e § 15",
        sourceUrl: planaltoSource,
        changeReason: "Majoração restabelecida pelo STF.",
      },
    ],
  },
  {
    id: "iof-insurance-vgbl",
    code: "IOF_INSURANCE_VGBL",
    operationType: "insurance_vgbl",
    versions: [
      {
        id: "iof-vgbl-v1",
        version: 1,
        effectiveFrom: "2025-01-01",
        effectiveTo: "2025-06-11",
        treatment: { kind: "not_applicable", reason: "before_decree_12499" },
        legalBasis: "Regra anterior ao Decreto 12.499/2025",
        sourceUrl: planaltoSource,
        changeReason: "Não incidência anterior à nova hipótese do VGBL.",
      },
      {
        id: "iof-vgbl-v2",
        version: 2,
        effectiveFrom: "2025-06-11",
        effectiveTo: "2025-06-27",
        treatment: vgblTreatment("same_insurer", "300000.00"),
        legalBasis: "Decreto 6.306/2007, art. 22, § 1º, i e j; § 5º, VI",
        sourceUrl: vgblSource,
        changeReason: "Limite de R$ 300 mil por seguradora em 2025.",
      },
      {
        id: "iof-vgbl-v3",
        version: 3,
        effectiveFrom: "2025-06-27",
        effectiveTo: "2025-07-17",
        treatment: { kind: "not_applicable", reason: "decree_12499_suspended" },
        legalBasis: "Período de suspensão do Decreto 12.499/2025",
        sourceUrl: suspensionSource,
        changeReason:
          "Não incidência nas operações realizadas durante a suspensão.",
      },
      {
        id: "iof-vgbl-v4",
        version: 4,
        effectiveFrom: "2025-07-17",
        effectiveTo: "2026-01-01",
        treatment: vgblTreatment("same_insurer", "300000.00"),
        legalBasis: "Decreto 6.306/2007, art. 22, § 1º, i e j; § 5º, VI",
        sourceUrl: vgblSource,
        changeReason: "Regra de 2025 restabelecida.",
      },
      {
        id: "iof-vgbl-v5",
        version: 5,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        treatment: vgblTreatment("all_insurers", "600000.00"),
        legalBasis: "Decreto 6.306/2007, art. 22, § 1º, e e j; § 5º, V",
        sourceUrl: planaltoSource,
        changeReason:
          "Limite anual de R$ 600 mil agregado entre seguradoras a partir de 2026.",
      },
    ],
  },
];

function snapshotHash(rule: SeedRule, version: SeedVersion): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        code: rule.code,
        operationType: rule.operationType,
        ...version,
      }),
    )
    .digest("hex");
}

async function ensureAdmin() {
  let user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (user) {
    const credential = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (!credential) {
      throw new Error(
        `User ${adminEmail} exists without a credential account. Repair the account before seeding; the seed never deletes historical actors.`,
      );
    }
  }
  if (!user) {
    await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: "TaxMan Admin",
      },
    });
    user = await prisma.user.findUniqueOrThrow({
      where: { email: adminEmail },
    });
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { platformRole: "super_admin" },
  });
}

async function main() {
  const admin = await ensureAdmin();
  for (const rule of rules) {
    const persistedRule = await prisma.taxRule.upsert({
      where: { code: rule.code },
      update: {},
      create: {
        id: rule.id,
        code: rule.code,
        operationType: rule.operationType,
      },
    });
    if (persistedRule.operationType !== rule.operationType) {
      throw new Error(`Rule ${rule.code} has a different operation type.`);
    }
    for (const version of rule.versions) {
      const content = {
        editorialStatus: "approved" as const,
        effectiveFrom: new Date(`${version.effectiveFrom}T00:00:00.000Z`),
        effectiveTo: version.effectiveTo
          ? new Date(`${version.effectiveTo}T00:00:00.000Z`)
          : null,
        treatment: version.treatment,
        legalBasis: version.legalBasis,
        sourceUrl: version.sourceUrl,
        changeReason: version.changeReason,
        snapshotHash: snapshotHash(rule, version),
      };
      await prisma.taxRuleVersion.upsert({
        where: {
          ruleId_version: {
            ruleId: persistedRule.id,
            version: version.version,
          },
        },
        // Approved seed versions are immutable. Legal/content changes require
        // a new version instead of rewriting historical provenance.
        update: {},
        create: {
          id: version.id,
          ruleId: persistedRule.id,
          version: version.version,
          ...content,
          createdById: admin.id,
          reviewedById: admin.id,
          approvedAt: new Date(),
        },
      });
    }
  }
  console.log(
    `Seeded ${rules.reduce((total, rule) => total + rule.versions.length, 0)} approved IOF rule versions and ${adminEmail}.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
