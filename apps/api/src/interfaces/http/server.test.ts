import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";

const authenticatedActor = {
  userId: "user_01",
  tenantId: "0198c9c7-6aa0-7cc7-9c54-e0f144372be1",
  segment: "credit_provider" as const,
  organizationRole: "owner" as const,
  isPlatformAdmin: false,
};

describe("HTTP authentication boundary", () => {
  const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it("rejects an unauthenticated calculation before validating its payload", async () => {
    const calculateTax = vi.fn();
    const server = await buildServer({
      authenticate: async () => null,
      calculateTax,
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/tax/calculate",
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthenticated" });
    expect(calculateTax).not.toHaveBeenCalled();
  });

  it("derives the calculation tenant from the authenticated organization", async () => {
    const calculateTax = vi.fn().mockResolvedValue({
      calculationId: "calculation_01",
      outcome: { kind: "not_applicable", ruleId: "rule_01", reason: "test" },
    });
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculateTax,
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/tax/calculate",
      payload: {
        operation: {
          kind: "credit",
          occurredOn: "2025-06-10",
          amount: 10_000,
          modality: "principal_defined",
          borrower: { personType: "PJ" },
          termInDays: 30,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calculateTax).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: authenticatedActor.userId,
        tenant: {
          id: authenticatedActor.tenantId,
          segment: authenticatedActor.segment,
        },
        operation: expect.objectContaining({ occurredOn: "2025-06-10" }),
      }),
    );
  });

  it("requires a signed-in user before starting company onboarding", async () => {
    const server = await buildServer({ authenticateUser: async () => null });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/onboarding",
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthenticated" });
  });

  it("forbids tenant users from the global rule administration", async () => {
    const server = await buildServer({
      authenticateUser: async () => ({
        userId: "tenant-user",
        sessionId: "session-1",
        isPlatformAdmin: false,
      }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/admin/rules",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("scopes calculation detail reads to the authenticated organization", async () => {
    const getCalculation = vi.fn().mockResolvedValue(null);
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      tenantQueries: {
        overview: vi.fn(),
        calculations: vi.fn(),
        getCalculation,
        company: vi.fn(),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/calculations/calc_01",
    });

    expect(response.statusCode).toBe(404);
    expect(getCalculation).toHaveBeenCalledWith(
      authenticatedActor.tenantId,
      "calc_01",
    );
  });
});
