import { describe, expect, it } from "vitest";
import {
  decodeCalculationCursor,
  encodeCalculationCursor,
} from "./calculation-cursor.js";

describe("calculation cursor", () => {
  it("round-trips an opaque stable pagination cursor", () => {
    const cursor = {
      createdAt: "2026-08-20T12:00:00.000Z",
      id: "0198c9c7-6aa0-7cc7-9c54-e0f144372be1",
    };
    expect(decodeCalculationCursor(encodeCalculationCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("rejects a cursor without its tie-breaker", () => {
    const malformed = Buffer.from(
      JSON.stringify({ createdAt: "2026-08-20T12:00:00.000Z" }),
    ).toString("base64url");
    expect(() => decodeCalculationCursor(malformed)).toThrow();
  });
});
