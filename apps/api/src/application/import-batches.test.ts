import { describe, expect, it, vi } from "vitest";
import {
  createImportBatchWorkflow,
  ImportBatchConflictError,
  type ImportBatchRepository,
} from "./import-batches.js";

const draft = {
  id: "0198ca00-0000-7000-8000-000000000001",
  status: "draft" as const,
  originalFileName: "credito.csv",
  operationType: null,
  headers: ["data", "valor", "prazo"],
  totalRows: 1,
  validRows: 0,
  invalidRows: 0,
  processedRows: 0,
  failedRows: 0,
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
};

function repository(): ImportBatchRepository {
  return {
    createUploaded: vi.fn().mockResolvedValue(draft),
    configureValidation: vi.fn().mockResolvedValue({ jobId: "job_01" }),
    queueProcessing: vi.fn().mockResolvedValue({ jobId: "job_02" }),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ ...draft, mapping: null, rowErrors: [] }),
    listReviewRows: vi.fn().mockResolvedValue({ items: [], nextRowNumber: null }),
    closeReview: vi.fn().mockResolvedValue({ ...draft, status: "closed" }),
    cancel: vi.fn().mockResolvedValue({ ...draft, status: "cancelled" }),
    listMappingProfiles: vi.fn().mockResolvedValue([]),
    deleteMappingProfile: vi.fn().mockResolvedValue(false),
  };
}

describe("import batch workflow", () => {
  it("stores a tenant-owned CSV and records its detected structure", async () => {
    const store = repository();
    const put = vi.fn();
    const workflow = createImportBatchWorkflow({
      repository: store,
      storage: { put, get: vi.fn(), remove: vi.fn() },
    });

    await workflow.upload({
      tenantId: "0198ca00-0000-7000-8000-000000000010",
      actorUserId: "user_01",
      fileName: "credito.csv",
      contentType: "text/csv",
      bytes: new TextEncoder().encode("data;valor;prazo\n20/08/2026;1000,00;30"),
    });

    expect(put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/\/imports\/[a-f0-9]{64}\.csv$/),
      }),
    );
    expect(store.createUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: ["data", "valor", "prazo"],
        delimiter: ";",
        totalRows: 1,
      }),
    );
  });

  it("rejects an operation outside the tenant segment before queueing", async () => {
    const store = repository();
    const workflow = createImportBatchWorkflow({
      repository: store,
      storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
    });

    await expect(
      workflow.configure({
        tenantId: "0198ca00-0000-7000-8000-000000000010",
        actorUserId: "user_01",
        segment: "insurance_pension",
        batchId: draft.id,
        mapping: {
          operationType: "credit_pj_principal_defined",
          dateFormat: "yyyy-mm-dd",
          numberFormat: "decimal_dot",
          columns: {
            occurredOn: "data",
            amount: "valor",
            termInDays: "prazo",
          },
        },
      }),
    ).rejects.toThrow(ImportBatchConflictError);
    expect(store.configureValidation).not.toHaveBeenCalled();
  });

  it("normalizes the review note before closing the batch", async () => {
    const store = repository();
    const workflow = createImportBatchWorkflow({
      repository: store,
      storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
    });

    await workflow.closeReview({
      tenantId: "0198ca00-0000-7000-8000-000000000010",
      actorUserId: "user_01",
      batchId: draft.id,
      note: "  Revisão concluída  ",
      acknowledgedInvalidRows: true,
      acknowledgedFailedRows: false,
    });

    expect(store.closeReview).toHaveBeenCalledWith(
      expect.objectContaining({ note: "Revisão concluída" }),
    );
  });

  it("rejects an unauditable cancellation reason", async () => {
    const workflow = createImportBatchWorkflow({
      repository: repository(),
      storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
    });

    await expect(
      workflow.cancel({
        tenantId: "0198ca00-0000-7000-8000-000000000010",
        actorUserId: "user_01",
        batchId: draft.id,
        reason: "não",
      }),
    ).rejects.toThrow("cancellation_reason_required");
  });
});
