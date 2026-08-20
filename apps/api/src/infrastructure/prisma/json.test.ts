import { describe, expect, it } from "vitest";
import { reais } from "../../domain/shared/money.js";
import { canonicalJson, jsonObject } from "./json.js";

describe("Prisma JSON serialization", () => {
  it("serializes money exactly and canonicalizes object keys", () => {
    const first = {
      treatment: {
        rate: { unit: "percent", percentage: "5" },
        basePolicy: {
          threshold: reais("600000.00"),
          scope: "all_insurers",
          kind: "aggregate_threshold",
        },
        kind: "rate",
      },
      version: 1,
    };
    const second = {
      version: 1,
      treatment: {
        kind: "rate",
        basePolicy: {
          kind: "aggregate_threshold",
          scope: "all_insurers",
          threshold: reais("600000.00"),
        },
        rate: { percentage: "5", unit: "percent" },
      },
    };

    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(jsonObject(first)).toMatchObject({
      treatment: { basePolicy: { threshold: "600000.00" } },
    });
  });
});
