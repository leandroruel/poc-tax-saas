import type { OrganizationRole } from "../../domain/tenancy/organization-access.js";

export type TeamMutationResult = "updated" | "removed" | "not_found" | "protected_member";

export interface TeamManagement {
  updateRole(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly memberId: string;
    readonly role: Exclude<OrganizationRole, "owner">;
  }): Promise<TeamMutationResult>;
  remove(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly memberId: string;
  }): Promise<TeamMutationResult>;
}
