import { describe, expect, it } from "vitest";
import { createTaxIdVault } from "./tax-id-vault.js";

describe("TaxIdVault", () => {
  it("encrypts CPF with randomized ciphertext and a stable blind index", () => {
    const vault = createTaxIdVault({
      encryptionKey: Buffer.alloc(32, 1),
      indexKey: Buffer.alloc(32, 2),
    });

    const first = vault.protect("52998224725");
    const second = vault.protect("52998224725");

    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.blindIndex).toBe(second.blindIndex);
    expect(vault.reveal(first)).toBe("52998224725");
  });
});
