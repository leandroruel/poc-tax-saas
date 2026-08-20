import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const AAD = Buffer.from("TaxMan:UserProfile:taxId:v1", "utf8");

export interface ProtectedTaxId {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly blindIndex: string;
}

export interface TaxIdVault {
  protect(taxId: string): ProtectedTaxId;
  reveal(protectedValue: Omit<ProtectedTaxId, "blindIndex">): string;
}

function assertKey(key: Buffer, name: string): void {
  if (key.byteLength !== 32)
    throw new Error(`${name} must contain exactly 32 bytes`);
}

export function createTaxIdVault(keys: {
  encryptionKey: Buffer;
  indexKey: Buffer;
}): TaxIdVault {
  assertKey(keys.encryptionKey, "encryptionKey");
  assertKey(keys.indexKey, "indexKey");

  return {
    protect(taxId) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", keys.encryptionKey, iv);
      cipher.setAAD(AAD);
      const ciphertext = Buffer.concat([
        cipher.update(taxId, "utf8"),
        cipher.final(),
      ]);
      return {
        ciphertext: ciphertext.toString("base64url"),
        iv: iv.toString("base64url"),
        authTag: cipher.getAuthTag().toString("base64url"),
        blindIndex: createHmac("sha256", keys.indexKey)
          .update(taxId)
          .digest("base64url"),
      };
    },
    reveal(protectedValue) {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        keys.encryptionKey,
        Buffer.from(protectedValue.iv, "base64url"),
      );
      decipher.setAAD(AAD);
      decipher.setAuthTag(Buffer.from(protectedValue.authTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(protectedValue.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

function developmentKey(purpose: string): Buffer {
  return createHash("sha256").update(`taxman-local-only:${purpose}`).digest();
}

function environmentKey(name: string, developmentPurpose: string): Buffer {
  const configured = process.env[name];
  if (configured) return Buffer.from(configured, "base64");
  if (process.env.NODE_ENV === "production")
    throw new Error(`${name} is required in production`);
  return developmentKey(developmentPurpose);
}

export function createEnvironmentTaxIdVault(): TaxIdVault {
  return createTaxIdVault({
    encryptionKey: environmentKey("PERSONAL_DATA_ENCRYPTION_KEY", "encryption"),
    indexKey: environmentKey("PERSONAL_DATA_INDEX_KEY", "blind-index"),
  });
}
