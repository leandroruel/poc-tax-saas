import { describe, expect, it } from "vitest";
import {
  assertImportBatchTransition,
  canTransitionImportBatch,
  importBatchReviewBlocker,
} from "./import-batch.js";

describe("import batch lifecycle", () => {
  it("allows a reviewed batch to close", () => {
    expect(canTransitionImportBatch("requires_review", "closed")).toBe(true);
  });

  it("keeps closed batches immutable", () => {
    expect(() => assertImportBatchTransition("closed", "processing")).toThrow(
      "closed -> processing",
    );
  });

  it("allows failed work to resume at the failed stage", () => {
    expect(canTransitionImportBatch("failed", "validating")).toBe(true);
    expect(canTransitionImportBatch("failed", "processing")).toBe(true);
  });

  it("does not cancel a batch while its job may still be writing", () => {
    expect(canTransitionImportBatch("validating", "cancelled")).toBe(false);
    expect(canTransitionImportBatch("processing", "cancelled")).toBe(false);
  });

  it("requires an explicit acknowledgement for every unresolved row class", () => {
    expect(
      importBatchReviewBlocker({
        status: "requires_review",
        invalidRows: 2,
        failedRows: 1,
        acknowledgedInvalidRows: false,
        acknowledgedFailedRows: false,
      }),
    ).toBe("invalid_rows_not_acknowledged");
    expect(
      importBatchReviewBlocker({
        status: "requires_review",
        invalidRows: 2,
        failedRows: 1,
        acknowledgedInvalidRows: true,
        acknowledgedFailedRows: false,
      }),
    ).toBe("failed_rows_not_acknowledged");
    expect(
      importBatchReviewBlocker({
        status: "requires_review",
        invalidRows: 2,
        failedRows: 1,
        acknowledgedInvalidRows: true,
        acknowledgedFailedRows: true,
      }),
    ).toBeNull();
  });
});
