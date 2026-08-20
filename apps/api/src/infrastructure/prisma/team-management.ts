import type { PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { TeamManagement } from "../../application/ports/team-management.js";

export function createPrismaTeamManagement(
  prisma: PrismaClient,
): TeamManagement {
  return {
    async updateRole(input) {
      return prisma.$transaction(async (transaction) => {
        const member = await transaction.member.findFirst({
          where: { id: input.memberId, organizationId: input.tenantId },
        });
        if (!member) return "not_found";
        if (member.role === "owner" || member.userId === input.actorUserId) {
          return "protected_member";
        }
        await transaction.member.update({
          where: { id: member.id },
          data: { role: input.role },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.actorUserId,
            organizationId: input.tenantId,
            action: "organization.member_role_updated",
            entityType: "Member",
            entityId: member.id,
            before: { role: member.role },
            after: { role: input.role },
          },
        });
        return "updated";
      });
    },
    async remove(input) {
      return prisma.$transaction(async (transaction) => {
        const member = await transaction.member.findFirst({
          where: { id: input.memberId, organizationId: input.tenantId },
        });
        if (!member) return "not_found";
        if (member.role === "owner" || member.userId === input.actorUserId) {
          return "protected_member";
        }
        await transaction.member.delete({ where: { id: member.id } });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.actorUserId,
            organizationId: input.tenantId,
            action: "organization.member_removed",
            entityType: "Member",
            entityId: member.id,
            before: { role: member.role, userId: member.userId },
          },
        });
        return "removed";
      });
    },
  };
}
