import type { PrismaClient } from "@prisma/client";
import type { TenantQueries } from "../../application/ports/tenant-queries.js";

function calculationView(calculation: {
  id: string;
  operationType: string;
  occurredOn: Date;
  input: unknown;
  outcome: unknown;
  ruleSnapshot: unknown;
  recalculatesId: string | null;
  createdAt: Date;
}) {
  return {
    id: calculation.id,
    operationType: calculation.operationType,
    occurredOn: calculation.occurredOn.toISOString().slice(0, 10),
    input: calculation.input,
    outcome: calculation.outcome,
    ruleSnapshot: calculation.ruleSnapshot,
    recalculatesId: calculation.recalculatesId,
    createdAt: calculation.createdAt.toISOString(),
  };
}

export function createPrismaTenantQueries(prisma: PrismaClient): TenantQueries {
  return {
    async overview(tenantId) {
      const [count, recent, ruleVersionCount] = await Promise.all([
        prisma.calculation.count({ where: { organizationId: tenantId } }),
        prisma.calculation.findMany({
          where: { organizationId: tenantId },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.taxRuleVersion.count({ where: { editorialStatus: "approved" } }),
      ]);
      return {
        totalCalculations: count,
        ruleVersionCount,
        recentCalculations: recent.map(calculationView),
      };
    },
    async calculations(tenantId) {
      const rows = await prisma.calculation.findMany({
        where: { organizationId: tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return rows.map(calculationView);
    },
    async getCalculation(tenantId, calculationId) {
      const row = await prisma.calculation.findFirst({
        where: { id: calculationId, organizationId: tenantId },
      });
      return row ? calculationView(row) : null;
    },
    async company(tenantId) {
      return prisma.organization.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          segment: true,
          createdAt: true,
          members: {
            select: {
              id: true,
              role: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    },
    async userContext(userId) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          platformRole: true,
          membership: {
            select: {
              role: true,
              organization: {
                select: { id: true, name: true, slug: true, segment: true },
              },
            },
          },
        },
      });
      return { ...user, onboardingRequired: user.membership === null };
    },
  };
}
