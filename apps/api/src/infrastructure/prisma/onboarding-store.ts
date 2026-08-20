import type { PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { OnboardingStore } from "../../application/ports/onboarding-store.js";

export function createPrismaOnboardingStore(
  prisma: PrismaClient,
): OnboardingStore {
  return {
    async complete(record) {
      return prisma.$transaction(async (transaction) => {
        const organizationId = uuidv7();
        await transaction.userProfile.create({
          data: {
            userId: record.userId,
            taxIdCiphertext: record.userTaxId.ciphertext,
            taxIdIv: record.userTaxId.iv,
            taxIdAuthTag: record.userTaxId.authTag,
            taxIdBlindIndex: record.userTaxId.blindIndex,
          },
        });
        await transaction.organization.create({
          data: { id: organizationId, ...record.organization },
        });
        await transaction.member.create({
          data: {
            id: uuidv7(),
            organizationId,
            userId: record.userId,
            role: "owner",
          },
        });
        await transaction.session.update({
          where: { id: record.sessionId, userId: record.userId },
          data: { activeOrganizationId: organizationId },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: record.userId,
            organizationId,
            action: "organization.onboarded",
            entityType: "Organization",
            entityId: organizationId,
            after: {
              name: record.organization.name,
              slug: record.organization.slug,
              segment: record.organization.segment,
            },
          },
        });
        return { organizationId };
      });
    },
  };
}
