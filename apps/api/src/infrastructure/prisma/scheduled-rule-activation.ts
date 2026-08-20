import type { PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { businessDateInBrazil } from "../../application/time/business-calendar.js";

/**
 * Records the activation edge for operations/notifications. Calculation
 * correctness never depends on this job: the catalog always queries the
 * approved version by effective period.
 */
export async function recordScheduledRuleActivations(
  prisma: PrismaClient,
  now = new Date(),
): Promise<number> {
  const today = businessDateInBrazil(now);
  const instant = new Date(`${today}T00:00:00.000Z`);
  const effectiveVersions = await prisma.taxRuleVersion.findMany({
    where: {
      editorialStatus: "approved",
      effectiveFrom: { lte: instant },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: instant } }],
    },
    select: { id: true, effectiveFrom: true },
  });

  if (effectiveVersions.length === 0) return 0;

  const alreadyRecorded = await prisma.auditLog.findMany({
    where: {
      action: "rule_version.became_active",
      entityType: "TaxRuleVersion",
      entityId: { in: effectiveVersions.map((version) => version.id) },
    },
    select: { entityId: true },
  });
  const recordedIds = new Set(alreadyRecorded.map((row) => row.entityId));
  const pending = effectiveVersions.filter(
    (version) => !recordedIds.has(version.id),
  );
  if (pending.length === 0) return 0;

  const { count } = await prisma.auditLog.createMany({
    data: pending.map((version) => ({
      id: uuidv7(),
      action: "rule_version.became_active",
      entityType: "TaxRuleVersion",
      entityId: version.id,
      after: {
        effectiveFrom: version.effectiveFrom.toISOString().slice(0, 10),
      },
      metadata: { trigger: "scheduled_activation", observedOn: today },
    })),
    skipDuplicates: true,
  });
  return count;
}
