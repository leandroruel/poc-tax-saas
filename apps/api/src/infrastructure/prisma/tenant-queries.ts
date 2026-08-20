import type { PrismaClient } from "@prisma/client";
import type { TenantQueries } from "../../application/ports/tenant-queries.js";
import {
  organizationPermissions,
  parseOrganizationRole,
} from "../../domain/tenancy/organization-access.js";

function requiredRole(value: string) {
  const role = parseOrganizationRole(value);
  if (!role) throw new Error(`Unsupported organization role: ${value}`);
  return role;
}

export function createPrismaTenantQueries(prisma: PrismaClient): TenantQueries {
  return {
    async company(tenantId) {
      const company = await prisma.organization.findUnique({
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
      if (!company) return null;
      return {
        ...company,
        createdAt: company.createdAt.toISOString(),
        members: company.members.map((member) => ({
          ...member,
          role: requiredRole(member.role),
          createdAt: member.createdAt.toISOString(),
        })),
      };
    },
    async userContext(userId) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          platformRole: true,
          profile: { select: { userId: true } },
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
      if (!user.membership) {
        return {
          ...user,
          profile: undefined,
          membership: null,
          onboardingRequired: true,
          profileRequired: false,
        };
      }
      const role = requiredRole(user.membership.role);
      return {
        ...user,
        profile: undefined,
        onboardingRequired: false,
        profileRequired: !user.profile,
        membership: {
          ...user.membership,
          role,
          permissions: organizationPermissions(role),
        },
      };
    },
  };
}
