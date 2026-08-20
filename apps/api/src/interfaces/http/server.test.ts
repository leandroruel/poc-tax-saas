import { afterEach, describe, expect, it, vi } from "vitest";
import { CalculationRevisionSourceNotFoundError } from "../../application/calculation-errors.js";
import type { ImportBatchWorkflow } from "../../application/import-batches.js";
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

function importBatchWorkflow(
  overrides: Partial<ImportBatchWorkflow> = {},
): ImportBatchWorkflow {
  return {
    upload: vi.fn(),
    configure: vi.fn(),
    process: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    reviewRows: vi.fn().mockResolvedValue({ items: [], nextRowNumber: null }),
    closeReview: vi.fn(),
    cancel: vi.fn(),
    mappingProfiles: vi.fn().mockResolvedValue([]),
    deleteMappingProfile: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

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
      createdThrough: undefined,
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
        job: vi.fn(),
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
        job: vi.fn(),
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
        job: vi.fn(),
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

  it("scopes job attempt details to the authenticated organization", async () => {
    const job = vi.fn().mockResolvedValue(null);
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      operationalQueries: {
        notifications: vi.fn(),
        markNotificationRead: vi.fn(),
        jobs: vi.fn(),
        job,
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/jobs/job_from_another_tenant",
    });

    expect(response.statusCode).toBe(404);
    expect(job).toHaveBeenCalledWith(
      authenticatedActor.tenantId,
      "job_from_another_tenant",
    );
  });

  it("retries a failed job through the authenticated organization scope", async () => {
    const retry = vi.fn().mockResolvedValue({ kind: "queued" });
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      jobOperations: { retry },
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/job_01/retry",
    });

    expect(response.statusCode).toBe(202);
    expect(retry).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      actorUserId: authenticatedActor.userId,
      jobId: "job_01",
    });
  });

  it("keeps reviewers from retrying jobs", async () => {
    const retry = vi.fn();
    const server = await buildServer({
      authenticate: async () => ({
        ...authenticatedActor,
        organizationRole: "reviewer",
      }),
      jobOperations: { retry },
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/jobs/job_01/retry",
    });

    expect(response.statusCode).toBe(403);
    expect(retry).not.toHaveBeenCalled();
  });

  it("lets a reviewer inspect tenant-scoped inconsistent rows", async () => {
    const reviewRows = vi.fn().mockResolvedValue({
      items: [],
      nextRowNumber: null,
    });
    const server = await buildServer({
      authenticate: async () => ({
        ...authenticatedActor,
        organizationRole: "reviewer",
      }),
      importBatches: importBatchWorkflow({ reviewRows }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/import-batches/batch_01/review-rows?status=failed&limit=40&afterRowNumber=12",
    });

    expect(response.statusCode).toBe(200);
    expect(reviewRows).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      batchId: "batch_01",
      statuses: ["failed"],
      afterRowNumber: 12,
      limit: 40,
    });
  });

  it("closes a reviewed batch with the authenticated reviewer identity", async () => {
    const closeReview = vi.fn().mockResolvedValue({
      id: "batch_01",
      status: "closed",
    });
    const server = await buildServer({
      authenticate: async () => ({
        ...authenticatedActor,
        organizationRole: "reviewer",
      }),
      importBatches: importBatchWorkflow({ closeReview }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/import-batches/batch_01/close-review",
      payload: {
        note: "Conferência concluída pelo revisor.",
        acknowledgedInvalidRows: true,
        acknowledgedFailedRows: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(closeReview).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      actorUserId: authenticatedActor.userId,
      batchId: "batch_01",
      note: "Conferência concluída pelo revisor.",
      acknowledgedInvalidRows: true,
      acknowledgedFailedRows: false,
    });
  });

  it("keeps operators from closing a batch review", async () => {
    const closeReview = vi.fn();
    const server = await buildServer({
      authenticate: async () => ({
        ...authenticatedActor,
        organizationRole: "operator",
      }),
      importBatches: importBatchWorkflow({ closeReview }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/import-batches/batch_01/close-review",
      payload: {
        note: "Tentativa sem permissão.",
        acknowledgedInvalidRows: true,
        acknowledgedFailedRows: true,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(closeReview).not.toHaveBeenCalled();
  });

  it("lists mapping profiles only inside the authenticated organization", async () => {
    const mappingProfiles = vi.fn().mockResolvedValue([]);
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      importBatches: importBatchWorkflow({ mappingProfiles }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/import-mapping-profiles?operationType=credit_pj_principal_defined",
    });

    expect(response.statusCode).toBe(200);
    expect(mappingProfiles).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      operationType: "credit_pj_principal_defined",
    });
  });

  it("deletes a mapping profile through the authenticated organization scope", async () => {
    const deleteMappingProfile = vi.fn().mockResolvedValue(true);
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      importBatches: importBatchWorkflow({ deleteMappingProfile }),
    });
    servers.push(server);

    const response = await server.inject({
      method: "DELETE",
      url: "/api/import-mapping-profiles/profile_01",
    });

    expect(response.statusCode).toBe(204);
    expect(deleteMappingProfile).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      actorUserId: authenticatedActor.userId,
      profileId: "profile_01",
    });
  });

  it("requests calculation exports within the authenticated organization", async () => {
    const requestExport = vi.fn().mockResolvedValue({
      artifact: { id: "export-01", status: "queued" },
      jobId: "job-01",
    });
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculationExports: {
        request: requestExport,
        list: vi.fn(),
        download: vi.fn(),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/api/calculation-exports",
      payload: {
        format: "csv",
        columns: ["calculationId", "taxAmount"],
        delimiter: ";",
        filters: { status: "calculated", occurredFrom: "2026-01-01" },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(requestExport).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      actorUserId: authenticatedActor.userId,
      format: "csv",
      columns: ["calculationId", "taxAmount"],
      delimiter: ";",
      filters: { status: "calculated", occurredFrom: "2026-01-01" },
    });
  });

  it("scopes export downloads before reading the stored object", async () => {
    const download = vi.fn().mockResolvedValue(null);
    const server = await buildServer({
      authenticate: async () => authenticatedActor,
      calculationExports: {
        request: vi.fn(),
        list: vi.fn(),
        download,
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/api/calculation-exports/export-from-another-tenant/download",
    });

    expect(response.statusCode).toBe(404);
    expect(download).toHaveBeenCalledWith({
      tenantId: authenticatedActor.tenantId,
      exportId: "export-from-another-tenant",
    });
  });
});
