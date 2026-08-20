import { parseCnpj } from "../domain/identity/cnpj.js";
import { parseCpf } from "../domain/identity/cpf.js";
import type { TaxIdVault } from "../infrastructure/security/tax-id-vault.js";
import type {
  OnboardingSegment,
  OnboardingStore,
} from "./ports/onboarding-store.js";

export interface OnboardCompanyCommand {
  userId: string;
  sessionId: string;
  cpf: string;
  company: {
    name: string;
    slug: string;
    cnpj: string;
    segment: OnboardingSegment;
  };
}

export type OnboardCompany = (
  command: OnboardCompanyCommand,
) => Promise<{
  organizationId: string;
  name: string;
  slug: string;
  segment: OnboardingSegment;
}>;

export function createOnboardCompany(dependencies: {
  store: OnboardingStore;
  taxIdVault: TaxIdVault;
}): OnboardCompany {
  return async (command) => {
    const organization = {
      name: command.company.name.trim(),
      slug: command.company.slug,
      taxId: parseCnpj(command.company.cnpj),
      segment: command.company.segment,
    };
    const result = await dependencies.store.complete({
      userId: command.userId,
      sessionId: command.sessionId,
      organization,
      userTaxId: dependencies.taxIdVault.protect(parseCpf(command.cpf)),
    });
    return {
      organizationId: result.organizationId,
      name: organization.name,
      slug: organization.slug,
      segment: organization.segment,
    };
  };
}
