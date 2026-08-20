import { fromNodeHeaders } from "better-auth/node";
import type {
  AuthenticateRequest,
  OrganizationRole,
} from "../../application/ports/authenticator.js";
import type { AuthenticateUser } from "../../application/ports/user-authenticator.js";
import type { TenantSegment } from "../../domain/tenancy/tenant-context.js";
import { prisma } from "../prisma/prisma-client.js";
import { auth } from "./auth.js";

export const authenticateUserWithBetterAuth: AuthenticateUser = async (
  headers,
) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });
  return {
    userId: session.user.id,
    sessionId: session.session.id,
    isPlatformAdmin: user?.platformRole === "super_admin",
  };
};

export const authenticateWithBetterAuth: AuthenticateRequest = async (
  headers,
) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });
  const organizationId = session?.session.activeOrganizationId;
  if (!session || !organizationId) return null;

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id, organizationId },
    select: {
      role: true,
      organization: { select: { segment: true } },
      user: { select: { platformRole: true } },
    },
  });
  if (!membership) return null;

  const organizationRole: OrganizationRole =
    membership.role === "owner" ||
    membership.role === "admin" ||
    membership.role === "member"
      ? membership.role
      : "member";

  return {
    userId: session.user.id,
    tenantId: organizationId,
    segment: membership.organization.segment as TenantSegment,
    organizationRole,
    isPlatformAdmin: membership.user.platformRole === "super_admin",
  };
};
