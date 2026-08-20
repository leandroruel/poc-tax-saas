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

  it("rejects ciphertext with a modified authentication tag", () => {
    const vault = createTaxIdVault({
      encryptionKey: Buffer.alloc(32, 1),
      indexKey: Buffer.alloc(32, 2),
    });
    const protectedValue = vault.protect("52998224725");
    const tag = Buffer.from(protectedValue.authTag, "base64url");
    tag[0] ^= 1;

    expect(() =>
      vault.reveal({
        ...protectedValue,
        authTag: tag.toString("base64url"),
      }),
    ).toThrow();
  });

  it("rejects ciphertext decrypted with a different key", () => {
    const original = createTaxIdVault({
      encryptionKey: Buffer.alloc(32, 1),
      indexKey: Buffer.alloc(32, 2),
    });
    const different = createTaxIdVault({
      encryptionKey: Buffer.alloc(32, 3),
      indexKey: Buffer.alloc(32, 2),
    });

    expect(() => different.reveal(original.protect("52998224725"))).toThrow();
  });

  it("requires 32-byte encryption and index keys", () => {
    expect(() =>
      createTaxIdVault({
        encryptionKey: Buffer.alloc(31),
        indexKey: Buffer.alloc(32),
      }),
    ).toThrow("encryptionKey must contain exactly 32 bytes");
  });
});
