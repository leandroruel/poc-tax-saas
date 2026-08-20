import type { PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";

function brazilianToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Records the activation edge for operations/notifications. Calculation
 * correctness never depends on this job: the catalog always queries the
 * approved version by effective period.
 */
export async function recordScheduledRuleActivations(
  prisma: PrismaClient,
  now = new Date(),
): Promise<number> {
  const today = brazilianToday(now);
  const instant = new Date(`${today}T00:00:00.000Z`);
  const effectiveVersions = await prisma.taxRuleVersion.findMany({
    where: {
      editorialStatus: "approved",
      effectiveFrom: { lte: instant },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
    },
    select: { id: true, effectiveFrom: true },
  });

  let recorded = 0;
  for (const version of effectiveVersions) {
    const existing = await prisma.auditLog.findFirst({
      where: {
        action: "rule_version.became_active",
        entityType: "TaxRuleVersion",
        entityId: version.id,
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.auditLog.create({
        data: {
          id: uuidv7(),
          action: "rule_version.became_active",
          entityType: "TaxRuleVersion",
          entityId: version.id,
          after: {
            effectiveFrom: version.effectiveFrom.toISOString().slice(0, 10),
          },
          metadata: { trigger: "scheduled_activation", observedOn: today },
        },
      });
      recorded++;
    }
  }
  return recorded;
}
