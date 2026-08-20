import { describe, expect, it, vi } from "vitest";
import { createCompleteUserProfile } from "./complete-user-profile.js";

describe("complete user profile", () => {
  it("normalizes and protects the CPF before persistence", async () => {
    const create = vi.fn();
    const protect = vi.fn().mockReturnValue({
      ciphertext: "ciphertext",
      iv: "iv",
      authTag: "tag",
      blindIndex: "index",
    });
    const complete = createCompleteUserProfile({
      store: { create },
      taxIdVault: { protect, reveal: vi.fn() },
    });

    await complete({ userId: "user_01", cpf: "529.982.247-25" });

    expect(protect).toHaveBeenCalledWith("52998224725");
    expect(create).toHaveBeenCalledWith({
      userId: "user_01",
      userTaxId: expect.objectContaining({ blindIndex: "index" }),
    });
  });
});
