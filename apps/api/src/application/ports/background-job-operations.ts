export type RetryBackgroundJobResult =
  | { readonly kind: "queued" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_retryable"; readonly reason: "not_failed" | "attempt_limit" };

export interface BackgroundJobOperations {
  retry(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly jobId: string;
  }): Promise<RetryBackgroundJobResult>;
}
