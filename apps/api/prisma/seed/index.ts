import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_TENANT_ID = "tenant_demo";
const REVIEWER = "seed:official-sources-2026-08-19";

const fullAmount = { kind: "full_amount" } satisfies Prisma.InputJsonObject;
const noConditions = [] satisfies Prisma.InputJsonArray;
const vgblConditions = [
  { kind: "person_type_is", role: "insured", value: "PF" },
  { kind: "payer_is", value: "policyholder" },
] satisfies Prisma.InputJsonArray;
const simplesConditions = [
  { kind: "maximum_amount", amount: "30000.00" },
] satisfies Prisma.InputJsonArray;
const fidcConditions = [
  { kind: "market_is", value: "primary" },
] satisfies Prisma.InputJsonArray;

interface RulePeriod {
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  vgblThreshold: string;
  vgblScope: "same_insurer" | "all_insurers";
  vgblLegalBasis: string;
}

function rulesForPeriod(period: RulePeriod): Prisma.TaxRuleCreateManyInput[] {
  const common = {
    taxType: "IOF",
    effectiveFrom: period.effectiveFrom,
    effectiveTo: period.effectiveTo,
    version: period.version,
    status: "in_force" as const,
    reviewedBy: REVIEWER,
  };

  return [
    {
      ...common,
      operationType: "insurance_vgbl",
      rate: "5",
      rateUnit: "percent",
      baseRule: "Only the part of the current contribution that crosses the accumulated threshold",
      legalBasis: period.vgblLegalBasis,
      conditions: vgblConditions,
      basePolicy: {
        kind: "aggregate_threshold",
        scope: period.vgblScope,
        threshold: period.vgblThreshold,
      },
    },
    {
      ...common,
      operationType: "credit_pj",
      rate: "0.0082",
      rateUnit: "daily_percent",
      additionalRate: "0.38",
      additionalRateUnit: "percent",
      baseRule: "Principal at 0.0082% per day, capped at 365 days, plus 0.38%",
      legalBasis: "Decreto 6.306/2007, art. 7º, I a V, § 1º e § 15",
      conditions: noConditions,
      basePolicy: fullAmount,
    },
    {
      ...common,
      operationType: "credit_simples_mei",
      rate: "0.00274",
      rateUnit: "daily_percent",
      additionalRate: "0.38",
      additionalRateUnit: "percent",
      baseRule: "Simples Nacional/MEI borrower and principal up to R$ 30,000",
      legalBasis: "Decreto 6.306/2007, art. 7º, VI, § 1º e § 15; art. 45, II",
      conditions: simplesConditions,
      basePolicy: fullAmount,
    },
    {
      ...common,
      operationType: "foreign_exchange_outflow",
      rate: "3.5",
      rateUnit: "percent",
      baseRule: "Non-exempt foreign-exchange outflow",
      legalBasis: "Decreto 6.306/2007, art. 15-B, XX a XXIV",
      conditions: noConditions,
      basePolicy: fullAmount,
    },
    {
      ...common,
      operationType: "foreign_exchange_inflow",
      rate: "0.38",
      rateUnit: "percent",
      baseRule: "Non-exempt foreign-exchange inflow",
      legalBasis: "Decreto 6.306/2007, art. 15-B, XXV",
      conditions: noConditions,
      basePolicy: fullAmount,
    },
    {
      ...common,
      operationType: "foreign_exchange_investment",
      rate: "1.1",
      rateUnit: "percent",
      baseRule: "Outbound transfer for investment purposes",
      legalBasis: "Decreto 6.306/2007, art. 15-B, XXI-A",
      conditions: noConditions,
      basePolicy: fullAmount,
    },
    {
      ...common,
      effectiveFrom:
        period.version === 1 ? new Date("2025-06-14T00:00:00.000Z") : period.effectiveFrom,
      operationType: "investment_fidc",
      rate: "0.38",
      rateUnit: "percent",
      baseRule: "Primary acquisition of FIDC quotas subscribed after 13 June 2025",
      legalBasis: "Decreto 6.306/2007, art. 32-D",
      conditions: fidcConditions,
      basePolicy: fullAmount,
    },
  ];
}

const rules = [
  ...rulesForPeriod({
    version: 1,
    effectiveFrom: new Date("2025-06-11T00:00:00.000Z"),
    effectiveTo: new Date("2026-01-01T00:00:00.000Z"),
    vgblThreshold: "300000.00",
    vgblScope: "same_insurer",
    vgblLegalBasis: "Decreto 6.306/2007, art. 22, § 1º, i e j; § 5º, VI",
  }),
  ...rulesForPeriod({
    version: 2,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    vgblThreshold: "600000.00",
    vgblScope: "all_insurers",
    vgblLegalBasis: "Decreto 6.306/2007, art. 22, § 1º, e e j; § 5º, V",
  }),
];

async function main() {
  await prisma.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    update: {},
    create: { id: DEMO_TENANT_ID, name: "Demo Tenant", config: {} },
  });

  await prisma.$transaction(
    rules.map((rule) =>
      prisma.taxRule.upsert({
        where: {
          taxType_operationType_version: {
            taxType: rule.taxType,
            operationType: rule.operationType,
            version: rule.version,
          },
        },
        update: rule,
        create: rule,
      })
    )
  );

  console.log(`Seeded ${rules.length} versioned IOF rules for tenant ${DEMO_TENANT_ID}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
