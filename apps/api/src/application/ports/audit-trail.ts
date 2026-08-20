export const auditCategories = [
  "calculations",
  "imports",
  "exports",
  "jobs",
  "organization",
] as const;

export type AuditCategory = (typeof auditCategories)[number];

export interface AuditCursor {
  readonly occurredAt: string;
  readonly id: string;
}

export interface AuditEventView {
  readonly id: string;
  readonly action: string;
  readonly category: AuditCategory;
  readonly entityType: string;
  readonly entityId: string;
  readonly occurredAt: string;
  readonly actor: { readonly id: string; readonly name: string } | null;
}

export interface AuditEventPage {
  readonly items: readonly AuditEventView[];
  readonly nextCursor: AuditCursor | null;
}

export interface AuditTrail {
  list(input: {
    readonly tenantId: string;
    readonly limit: number;
    readonly category?: AuditCategory;
    readonly cursor?: AuditCursor;
  }): Promise<AuditEventPage>;
}
