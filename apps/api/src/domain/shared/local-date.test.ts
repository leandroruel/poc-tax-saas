import { describe, expect, it } from "vitest";
import { elapsedCalendarDays, isLocalDate } from "./local-date.js";

describe("local dates", () => {
  it("rejects impossible calendar dates", () => {
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2024-02-29")).toBe(true);
  });

  it("counts elapsed days without timezone or daylight-saving drift", () => {
    expect(elapsedCalendarDays("2024-02-28", "2024-03-01")).toBe(2);
  });
});
