import type { PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { UserProfileStore } from "../../application/ports/user-profile-store.js";

export function createPrismaUserProfileStore(
  prisma: PrismaClient,
): UserProfileStore {
  return {
    async create(input) {
      await prisma.$transaction(async (transaction) => {
        const membership = await transaction.member.findUniqueOrThrow({
          where: { userId: input.userId },
          select: { organizationId: true },
        });
        await transaction.userProfile.create({
          data: {
            userId: input.userId,
            taxIdCiphertext: input.userTaxId.ciphertext,
            taxIdIv: input.userTaxId.iv,
            taxIdAuthTag: input.userTaxId.authTag,
            taxIdBlindIndex: input.userTaxId.blindIndex,
          },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.userId,
            organizationId: membership.organizationId,
            action: "organization.profile_completed",
            entityType: "UserProfile",
            entityId: input.userId,
          },
        });
      });
    },
  };
}
