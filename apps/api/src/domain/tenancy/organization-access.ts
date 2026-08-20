export type OrganizationRole = "owner" | "admin" | "operator" | "reviewer";

export type OrganizationPermission =
  | "dashboard:read"
  | "calculation:read"
  | "calculation:create"
  | "company:read"
  | "team:manage"
  | "batch:read"
  | "batch:create"
  | "batch:review"
  | "job:read"
  | "job:retry"
  | "notification:read";

const permissionsByRole = {
  owner: [
    "dashboard:read",
    "calculation:read",
    "calculation:create",
    "company:read",
    "team:manage",
    "batch:read",
    "batch:create",
    "batch:review",
    "job:read",
    "job:retry",
    "notification:read",
  ],
  admin: [
    "dashboard:read",
    "calculation:read",
    "calculation:create",
    "company:read",
    "team:manage",
    "batch:read",
    "batch:create",
    "batch:review",
    "job:read",
    "job:retry",
    "notification:read",
  ],
  operator: [
    "dashboard:read",
    "calculation:read",
    "calculation:create",
    "company:read",
    "batch:read",
    "batch:create",
    "job:read",
    "job:retry",
    "notification:read",
  ],
  reviewer: [
    "dashboard:read",
    "calculation:read",
    "company:read",
    "batch:read",
    "batch:review",
    "job:read",
    "notification:read",
  ],
} as const satisfies Record<OrganizationRole, readonly OrganizationPermission[]>;

export function organizationPermissions(
  role: OrganizationRole,
): readonly OrganizationPermission[] {
  return permissionsByRole[role];
}

export function can(
  role: OrganizationRole,
  permission: OrganizationPermission,
): boolean {
  return organizationPermissions(role).includes(permission);
}

/**
 * `member` is Better Auth's historical default. Existing rows are interpreted
 * as operators until the team-management migration replaces that legacy role.
 * Unknown values fail closed instead of silently gaining member permissions.
 */
export function parseOrganizationRole(
  value: string,
): OrganizationRole | null {
  if (value === "member") return "operator";
  if (
    value === "owner" ||
    value === "admin" ||
    value === "operator" ||
    value === "reviewer"
  ) {
    return value;
  }
  return null;
}
