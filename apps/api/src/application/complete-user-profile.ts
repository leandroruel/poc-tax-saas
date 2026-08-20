import { parseCpf } from "../domain/identity/cpf.js";
import type { TaxIdVault } from "../infrastructure/security/tax-id-vault.js";
import type { UserProfileStore } from "./ports/user-profile-store.js";

export type CompleteUserProfile = (command: {
  readonly userId: string;
  readonly cpf: string;
}) => Promise<void>;

export function createCompleteUserProfile(dependencies: {
  readonly store: UserProfileStore;
  readonly taxIdVault: TaxIdVault;
}): CompleteUserProfile {
  return async (command) => {
    await dependencies.store.create({
      userId: command.userId,
      userTaxId: dependencies.taxIdVault.protect(parseCpf(command.cpf)),
    });
  };
}
