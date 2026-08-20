import { describe, expect, it, vi } from "vitest";
import {
  createCalculationExportWorkflow,
  type CalculationExportRepository,
  type CalculationExportSummary,
} from "./calculation-exports.js";
import { calculationExportColumns } from "./exports/calculation-export.js";

const artifact: CalculationExportSummary = {
  id: "export-01",
  status: "queued",
  format: "csv",
  columns: ["calculationId"],
  filters: { createdThrough: "2026-08-20T12:00:00.000Z" },
  fileName: null,
  rowCount: 0,
  errorMessage: null,
  createdAt: "2026-08-20T12:00:00.000Z",
  readyAt: null,
};

function repository(
  overrides: Partial<CalculationExportRepository> = {},
): CalculationExportRepository {
  return {
    request: vi.fn().mockResolvedValue({ artifact, jobId: "job-01" }),
    list: vi.fn().mockResolvedValue([]),
    downloadable: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("calculation export workflow", () => {
  it("captures a stable time boundary and removes duplicate CSV columns", async () => {
    const exports = repository();
    const workflow = createCalculationExportWorkflow({
      repository: exports,
      storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
      now: () => new Date("2026-08-20T12:00:00.000Z"),
    });

    await workflow.request({
      tenantId: "tenant-01",
      actorUserId: "user-01",
      format: "csv",
      columns: ["calculationId", "taxAmount", "calculationId"],
      filters: { status: "calculated" },
    });

    expect(exports.request).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-01",
        actorUserId: "user-01",
        columns: ["calculationId", "taxAmount"],
        filters: {
          status: "calculated",
          createdThrough: "2026-08-20T12:00:00.000Z",
        },
        options: { delimiter: ";" },
      }),
    );
  });

  it("keeps the evidence format fixed to the complete audited schema", async () => {
    const exports = repository();
    const workflow = createCalculationExportWorkflow({
      repository: exports,
      storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
    });

    await workflow.request({
      tenantId: "tenant-01",
      actorUserId: "user-01",
      format: "evidence_json",
      columns: ["taxAmount"],
      filters: {},
    });

    expect(exports.request).toHaveBeenCalledWith(
      expect.objectContaining({ columns: calculationExportColumns }),
    );
  });

  it("resolves object storage only after a tenant-scoped artifact lookup", async () => {
    const downloadable = vi.fn().mockResolvedValue({
      objectKey: "tenant-01/exports/export-01.csv",
      fileName: "taxman-calculos-export-01.csv",
      contentType: "text/csv; charset=utf-8",
    });
    const get = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const workflow = createCalculationExportWorkflow({
      repository: repository({ downloadable }),
      storage: { put: vi.fn(), get, remove: vi.fn() },
    });

    const result = await workflow.download({
      tenantId: "tenant-01",
      exportId: "export-01",
    });

    expect(downloadable).toHaveBeenCalledWith("tenant-01", "export-01");
    expect(get).toHaveBeenCalledWith("tenant-01/exports/export-01.csv");
    expect(result?.bytes).toEqual(new Uint8Array([1, 2, 3]));
  });
});
