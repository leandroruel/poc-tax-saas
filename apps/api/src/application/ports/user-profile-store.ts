import type { ProtectedTaxId } from "../../infrastructure/security/tax-id-vault.js";

export interface UserProfileStore {
  create(input: {
    readonly userId: string;
    readonly userTaxId: ProtectedTaxId;
  }): Promise<void>;
}
