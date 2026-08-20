export interface TenantQueries {
  overview(tenantId: string): Promise<unknown>;
  calculations(tenantId: string): Promise<unknown[]>;
  getCalculation(
    tenantId: string,
    calculationId: string,
  ): Promise<unknown | null>;
  company(tenantId: string): Promise<unknown | null>;
  userContext(userId: string): Promise<unknown>;
}
