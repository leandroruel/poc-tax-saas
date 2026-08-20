import { describe, expect, it } from "vitest";
import {
  assertImportBatchTransition,
  canTransitionImportBatch,
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
});
