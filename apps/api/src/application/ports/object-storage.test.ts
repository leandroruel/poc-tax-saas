import { describe, expect, it } from "vitest";
import { tenantObjectKey } from "./object-storage.js";

describe("tenant object keys", () => {
  it("partitions objects by tenant", () => {
    expect(
      tenantObjectKey({
        tenantId: "0198c9c7-6aa0-7cc7-9c54-e0f144372be1",
        category: "imports",
        objectId: "0198c9c7-6aa0-7cc7-9c54-e0f144372be2",
        extension: "CSV",
      }),
    ).toBe(
      "0198c9c7-6aa0-7cc7-9c54-e0f144372be1/imports/0198c9c7-6aa0-7cc7-9c54-e0f144372be2.csv",
    );
  });

  it("rejects path traversal", () => {
    expect(() =>
      tenantObjectKey({
        tenantId: "../another-tenant",
        category: "imports",
        objectId: "file",
        extension: "csv",
      }),
    ).toThrow("Unsafe object storage key part");
  });
});
