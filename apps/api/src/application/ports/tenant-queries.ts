import type {
  OrganizationPermission,
  OrganizationRole,
} from "../../domain/tenancy/organization-access.js";
import type { TenantSegment } from "../../domain/tenancy/tenant-context.js";

export interface TenantCompanyView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly segment: TenantSegment;
  readonly createdAt: string;
  readonly members: readonly {
    readonly id: string;
    readonly role: OrganizationRole;
    readonly createdAt: string;
    readonly user: {
      readonly id: string;
      readonly name: string;
      readonly email: string;
    };
  }[];
}

export interface UserContextView {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly platformRole: "user" | "super_admin";
  readonly onboardingRequired: boolean;
  readonly membership: null | {
    readonly role: OrganizationRole;
    readonly permissions: readonly OrganizationPermission[];
    readonly organization: {
      readonly id: string;
      readonly name: string;
      readonly slug: string;
      readonly segment: TenantSegment;
    };
  };
}

export interface TenantQueries {
  company(tenantId: string): Promise<TenantCompanyView | null>;
  userContext(userId: string): Promise<UserContextView>;
}
