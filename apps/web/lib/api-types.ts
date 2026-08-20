export type OrganizationRole = "owner" | "admin" | "operator" | "reviewer";
export type OrganizationPermission =
  | "dashboard:read"
  | "calculation:read"
  | "calculation:create"
  | "company:read"
  | "team:manage"
  | "batch:read"
  | "batch:create"
  | "batch:review"
  | "job:read"
  | "job:retry"
  | "notification:read"
  | "export:read"
  | "export:create";
export type TenantSegment = "credit_provider" | "insurance_pension";

export type Me = {
  id: string;
  name: string;
  email: string;
  platformRole: "user" | "super_admin";
  onboardingRequired: boolean;
  membership: null | {
    role: OrganizationRole;
    permissions: OrganizationPermission[];
    organization: {
      id: string;
      name: string;
      slug: string;
      segment: TenantSegment;
    };
  };
};

export type CalculationOperationType =
  | "credit_pj_principal_defined"
  | "insurance_vgbl";

export type CalculationStatus =
  | "calculated"
  | "unsupported"
  | "not_applicable"
  | "requires_context"
  | "no_rule"
  | "ambiguous_rule";

export type CalculationOutcome =
  | {
      kind: "calculated";
      result: {
        amount: string;
        taxableBase: string;
        grossBase: string;
        ruleId: string;
        ruleVersion: number;
        operationType: CalculationOperationType;
        legalBasis: string;
      };
    }
  | { kind: "unsupported"; reason: string }
  | { kind: "not_applicable"; ruleId: string; reason: string }
  | { kind: "requires_context"; missing: string[] }
  | { kind: "no_rule"; operationType: CalculationOperationType }
  | { kind: "ambiguous_rule"; ruleIds: string[] };

export type CalculationRecord = {
  id: string;
  operationType: CalculationOperationType;
  occurredOn: string;
  outcome: CalculationOutcome;
  recalculatesId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
};

export type CalculationPage = {
  items: CalculationRecord[];
  nextCursor: string | null;
};

export type DashboardOverview = {
  totalCalculations: number;
  ruleVersionCount: number;
  calculatedTaxAmount30Days: string;
  attentionRequired: number;
  activity: {
    date: string;
    calculations: number;
    taxAmount: string;
  }[];
  recentCalculations: CalculationRecord[];
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  segment: TenantSegment;
  createdAt: string;
  members: {
    id: string;
    role: OrganizationRole;
    createdAt: string;
    user: { id: string; name: string; email: string };
  }[];
};

export type NotificationFeed = {
  unreadCount: number;
  items: {
    id: string;
    type:
      | "batch_completed"
      | "batch_requires_review"
      | "job_failed"
      | "job_recovered"
      | "export_ready"
      | "rule_scheduled"
      | "rule_activated";
    title: string;
    message: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    readAt: string | null;
  }[];
};

export type ImportBatchStatus =
  | "draft"
  | "validating"
  | "ready"
  | "processing"
  | "requires_review"
  | "closed"
  | "failed"
  | "cancelled";

export type ImportBatch = {
  id: string;
  status: ImportBatchStatus;
  originalFileName: string | null;
  operationType: CalculationOperationType | null;
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  processedRows: number;
  failedRows: number;
  createdAt: string;
  updatedAt: string;
};

export type ImportBatchDetail = ImportBatch & {
  mapping: unknown;
  rowErrors: {
    rowNumber: number;
    rawData: Record<string, string>;
    errors: { field: string; code: string; message: string }[];
  }[];
};

export type BackgroundJob = {
  id: string;
  batchId: string | null;
  exportId: string | null;
  type: string;
  status: "queued" | "active" | "retrying" | "completed" | "failed" | "cancelled";
  progress: { current: number; total: number };
  attemptsMade: number;
  maxAttempts: number;
  correlationId: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalculationExportColumn =
  | "calculationId"
  | "operationType"
  | "occurredOn"
  | "status"
  | "taxAmount"
  | "taxableBase"
  | "grossBase"
  | "ruleId"
  | "ruleVersion"
  | "legalBasis"
  | "createdAt"
  | "createdBy";

export type CalculationExport = {
  id: string;
  status: "queued" | "ready" | "failed";
  format: "csv" | "evidence_json";
  columns: CalculationExportColumn[];
  filters: {
    calculationId?: string;
    operationType?: CalculationOperationType;
    status?: CalculationStatus;
    occurredFrom?: string;
    occurredTo?: string;
    createdThrough: string;
  };
  fileName: string | null;
  rowCount: number;
  errorMessage: string | null;
  createdAt: string;
  readyAt: string | null;
};
