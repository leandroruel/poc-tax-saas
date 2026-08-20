import { describe, expect, it } from "vitest";
import { decodeAuditCursor, encodeAuditCursor } from "./audit-cursor.js";

describe("audit cursor", () => {
  it("round-trips an opaque stable cursor", () => {
    const cursor = {
      occurredAt: "2026-08-20T12:30:00.000Z",
      id: "audit_01",
    };
    expect(decodeAuditCursor(encodeAuditCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeAuditCursor("not-a-cursor")).toThrow();
  });
});
