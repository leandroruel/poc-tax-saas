import { describe, expect, it } from "vitest";
import {
  can,
  organizationPermissions,
  parseOrganizationRole,
} from "./organization-access.js";

describe("organization access policy", () => {
  it("allows operators to calculate without granting team administration", () => {
    expect(can("operator", "calculation:create")).toBe(true);
    expect(can("operator", "team:manage")).toBe(false);
  });

  it("keeps reviewers read-only", () => {
    expect(can("reviewer", "calculation:read")).toBe(true);
    expect(can("reviewer", "calculation:create")).toBe(false);
    expect(can("reviewer", "batch:review")).toBe(true);
    expect(can("reviewer", "batch:create")).toBe(false);
  });

  it("returns the capabilities exposed to callers", () => {
    expect(organizationPermissions("admin")).toContain("team:manage");
    expect(organizationPermissions("operator")).toContain("audit:read");
    expect(organizationPermissions("reviewer")).toContain("audit:read");
  });

  it("maps Better Auth's legacy member role to operator", () => {
    expect(parseOrganizationRole("member")).toBe("operator");
    expect(parseOrganizationRole("unknown")).toBeNull();
  });
});
