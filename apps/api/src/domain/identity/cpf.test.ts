import { describe, expect, it } from "vitest";
import { parseCpf } from "./cpf.js";

describe("CPF", () => {
  it("normalizes a valid CPF before it reaches persistence", () => {
    expect(parseCpf("529.982.247-25")).toBe("52998224725");
  });
});
