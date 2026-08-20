import type { TenantSegment } from "../../domain/tenancy/tenant-context.js";
import type { OrganizationRole } from "../../domain/tenancy/organization-access.js";

export type RequestHeaders = Readonly<
  Record<string, string | string[] | undefined>
>;

export interface AuthenticatedActor {
  readonly userId: string;
  readonly tenantId: string;
  readonly segment: TenantSegment;
  readonly organizationRole: OrganizationRole;
  readonly isPlatformAdmin: boolean;
}

export type AuthenticateRequest = (
  headers: RequestHeaders,
) => Promise<AuthenticatedActor | null>;
