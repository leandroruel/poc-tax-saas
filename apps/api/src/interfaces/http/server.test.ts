import { afterEach, describe, expect, it, vi } from "vitest";
import { CalculationRevisionSourceNotFoundError } from "../../application/calculation-errors.js";
import { buildServer } from "./server.js";

const authenticatedActor = {
  userId: "user_01",
  tenantId: "0198c9c7-6aa0-7cc7-9c54-e0f144372be1",
  segment: "credit_provider" as const,
  organizationRole: "owner" as const,
  isPlatformAdmin: false,
};

const validCreditPayload = {
  operation: {
    kind: "credit",
    occurredOn: "2025-06-10",
    amount: 10_000,
    modality: "principal_defined",
    borrower: { personType: "PJ" },
    termInDays: 30,
  },
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
      payload: validCreditPayload,
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

  it("keeps reviewers from creating calculations", async () => {
    const calculateTax = vi.fn();
    const server = await buildServer({
      authenticate: async () => ({
        ...authenticatedActor,
        organizationRole: "reviewer",
      }),
      calculateTax,
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/tax/calculate",
      payload: validCreditPayload,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(calculateTax).not.toHaveBeenCalled();
  });

  it("does not reveal a calculation from another tenant as a revision source", async () => {
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculateTax: async () => {
        throw new CalculationRevisionSourceNotFoundError(
          "0198c9c7-6aa0-7cc7-9c54-e0f144372be2",
        );
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/tax/calculate",
      payload: {
        ...validCreditPayload,
        recalculatesId: "0198c9c7-6aa0-7cc7-9c54-e0f144372be2",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "calculation_revision_source_not_found",
    });
  });

  it("returns conflict for ambiguous rule configuration", async () => {
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculateTax: async () => ({
        calculationId: "calculation_ambiguous",
        outcome: { kind: "ambiguous_rule", ruleIds: ["rule-1", "rule-2"] },
      }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/tax/calculate",
      payload: validCreditPayload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ status: "ambiguous_rule" });
  });

  it("returns forbidden when the tenant segment lacks the capability", async () => {
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculateTax: async () => ({
        calculationId: "calculation_unsupported",
        outcome: {
          kind: "unsupported",
          reason: "segment_capability_mismatch",
        },
      }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/tax/calculate",
      payload: validCreditPayload,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ status: "unsupported" });
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
        company: vi.fn(),
        userContext: vi.fn(),
      },
      calculationLedger: {
        overview: vi.fn(),
        list: vi.fn(),
        get: getCalculation,
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

  it("passes validated filters and an opaque cursor to the tenant ledger", async () => {
    const list = vi.fn().mockResolvedValue({
      items: [],
      nextCursor: {
        createdAt: "2026-08-20T12:00:00.000Z",
        id: "calculation_01",
      },
    });
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculationLedger: {
        overview: vi.fn(),
        list,
        get: vi.fn(),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/calculations?limit=20&operationType=credit_pj_principal_defined&status=calculated&occurredFrom=2025-01-01&occurredTo=2025-12-31",
    });

    expect(response.statusCode).toBe(200);
    expect(list).toHaveBeenCalledWith(authenticatedActor.tenantId, {
      limit: 20,
      cursor: undefined,
      calculationId: undefined,
      operationType: "credit_pj_principal_defined",
      status: "calculated",
      occurredFrom: "2025-01-01",
      occurredTo: "2025-12-31",
    });
    expect(response.json()).toMatchObject({ items: [] });
    expect(response.json().nextCursor).toEqual(expect.any(String));
  });

  it("rejects a malformed ledger cursor", async () => {
    const list = vi.fn();
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculationLedger: {
        overview: vi.fn(),
        list,
        get: vi.fn(),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/calculations?cursor=not-a-cursor",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_cursor" });
    expect(list).not.toHaveBeenCalled();
  });

  it("scopes notifications to both the organization and signed-in user", async () => {
    const notifications = vi.fn().mockResolvedValue({
      items: [],
      unreadCount: 0,
    });
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      operationalQueries: {
        notifications,
        markNotificationRead: vi.fn(),
        jobs: vi.fn(),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/notifications?limit=12",
    });

    expect(response.statusCode).toBe(200);
    expect(notifications).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      userId: authenticatedActor.userId,
      limit: 12,
    });
  });

  it("does not mark another user's or tenant's notification as read", async () => {
    const markNotificationRead = vi.fn().mockResolvedValue(false);
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      operationalQueries: {
        notifications: vi.fn(),
        markNotificationRead,
        jobs: vi.fn(),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/notifications/notification_01/read",
    });

    expect(response.statusCode).toBe(404);
    expect(markNotificationRead).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      userId: authenticatedActor.userId,
      notificationId: "notification_01",
    });
  });

  it("scopes job monitoring to the authenticated organization", async () => {
    const jobs = vi.fn().mockResolvedValue([]);
    const server = await buildServer({
      authenticate: async () => ({
        ...authenticatedActor,
        organizationRole: "reviewer",
      }),
      operationalQueries: {
        notifications: vi.fn(),
        markNotificationRead: vi.fn(),
        jobs,
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/jobs?limit=25",
    });

    expect(response.statusCode).toBe(200);
    expect(jobs).toHaveBeenCalledWith(authenticatedActor.tenantId, 25);
  });
});
