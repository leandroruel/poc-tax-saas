import type { IncomingHttpHeaders } from "node:http";
import type { TenantSegment } from "../../domain/tenancy/tenant-context.js";

export type OrganizationRole = "owner" | "admin" | "member";

export interface AuthenticatedActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly segment: TenantSegment;
  readonly organizationRole: OrganizationRole;
  readonly isPlatformAdmin: boolean;
}

export type AuthenticateRequest = (
  headers: IncomingHttpHeaders,
) => Promise<AuthenticatedActor | null>;
