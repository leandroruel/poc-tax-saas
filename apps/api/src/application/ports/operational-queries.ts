export type NotificationKind =
  | "batch_completed"
  | "batch_requires_review"
  | "job_failed"
  | "job_recovered"
  | "export_ready"
  | "rule_scheduled"
  | "rule_activated";

export interface NotificationView {
  readonly id: string;
  readonly type: NotificationKind;
  readonly title: string;
  readonly message: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly createdAt: string;
  readonly readAt: string | null;
}

export interface BackgroundJobView {
  readonly id: string;
  readonly batchId: string | null;
  readonly exportId: string | null;
  readonly type: string;
  readonly status:
    | "queued"
    | "active"
    | "retrying"
    | "completed"
    | "failed"
    | "cancelled";
  readonly progress: { readonly current: number; readonly total: number };
  readonly attemptsMade: number;
  readonly maxAttempts: number;
  readonly correlationId: string;
  readonly lastErrorCode: string | null;
  readonly lastErrorMessage: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BackgroundJobDetail extends BackgroundJobView {
  readonly attempts: readonly {
    readonly id: string;
    readonly number: number;
    readonly status: "active" | "completed" | "failed";
    readonly correlationId: string;
    readonly errorCode: string | null;
    readonly errorMessage: string | null;
    readonly startedAt: string;
    readonly finishedAt: string | null;
  }[];
}

export interface OperationalQueries {
  notifications(input: {
    tenantId: string;
    userId: string;
    limit: number;
  }): Promise<{
    items: readonly NotificationView[];
    unreadCount: number;
  }>;
  markNotificationRead(input: {
    tenantId: string;
    userId: string;
    notificationId: string;
  }): Promise<boolean>;
  jobs(tenantId: string, limit: number): Promise<readonly BackgroundJobView[]>;
  job(tenantId: string, jobId: string): Promise<BackgroundJobDetail | null>;
}
