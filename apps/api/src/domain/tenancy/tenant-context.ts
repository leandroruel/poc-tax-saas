export type TenantId = string & { readonly __brand: "TenantId" };
export type TenantSegment =
  | "credit_provider"
  | "insurance_pension"
  | "general_business";

export interface TenantContext {
  id: string;
  segment: TenantSegment;
}
