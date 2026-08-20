export type OrganizationRole = "owner" | "admin" | "operator" | "reviewer";

export type OrganizationPermission =
  | "dashboard:read"
  | "calculation:read"
  | "calculation:create"
  | "company:read"
  | "team:manage"
  | "audit:read"
  | "batch:read"
  | "batch:create"
  | "batch:review"
  | "job:read"
  | "job:retry"
  | "notification:read"
  | "export:read"
  | "export:create";

const permissionsByRole = {
  owner: [
    "dashboard:read",
    "calculation:read",
    "calculation:create",
    "company:read",
    "team:manage",
    "audit:read",
    "batch:read",
    "batch:create",
    "batch:review",
    "job:read",
    "job:retry",
    "notification:read",
    "export:read",
    "export:create",
  ],
  admin: [
    "dashboard:read",
    "calculation:read",
    "calculation:create",
    "company:read",
    "team:manage",
    "audit:read",
    "batch:read",
    "batch:create",
    "batch:review",
    "job:read",
    "job:retry",
    "notification:read",
    "export:read",
    "export:create",
  ],
  operator: [
    "dashboard:read",
    "calculation:read",
    "calculation:create",
    "company:read",
    "audit:read",
    "batch:read",
    "batch:create",
    "job:read",
    "job:retry",
    "notification:read",
    "export:read",
    "export:create",
  ],
  reviewer: [
    "dashboard:read",
    "calculation:read",
    "company:read",
    "audit:read",
    "batch:read",
    "batch:review",
    "job:read",
    "notification:read",
    "export:read",
    "export:create",
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
