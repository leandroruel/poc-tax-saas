import type { ProtectedTaxId } from "../../infrastructure/security/tax-id-vault.js";

export type OnboardingSegment = "credit_provider" | "insurance_pension";

export interface CompleteOnboardingRecord {
  userId: string;
  sessionId: string;
  organization: {
    name: string;
    slug: string;
    taxId: string;
    segment: OnboardingSegment;
  };
  userTaxId: ProtectedTaxId;
}

export interface OnboardingStore {
  complete(
    record: CompleteOnboardingRecord,
  ): Promise<{ organizationId: string }>;
}
