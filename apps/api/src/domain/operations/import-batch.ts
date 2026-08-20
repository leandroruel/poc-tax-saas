export type ImportBatchStatus =
  | "draft"
  | "validating"
  | "ready"
  | "processing"
  | "requires_review"
  | "closed"
  | "failed"
  | "cancelled";

const nextStatuses = {
  draft: ["validating", "cancelled"],
  validating: ["ready", "failed"],
  ready: ["processing", "cancelled"],
  processing: ["requires_review", "failed"],
  requires_review: ["processing", "closed", "cancelled"],
  failed: ["validating", "processing", "cancelled"],
  closed: [],
  cancelled: [],
} as const satisfies Record<ImportBatchStatus, readonly ImportBatchStatus[]>;

export function canTransitionImportBatch(
  current: ImportBatchStatus,
  next: ImportBatchStatus,
): boolean {
  return nextStatuses[current].some((candidate) => candidate === next);
}

export function assertImportBatchTransition(
  current: ImportBatchStatus,
  next: ImportBatchStatus,
): void {
  if (!canTransitionImportBatch(current, next)) {
    throw new Error(`Invalid import batch transition: ${current} -> ${next}`);
  }
}

export function importBatchReviewBlocker(input: {
  readonly status: ImportBatchStatus;
  readonly invalidRows: number;
  readonly failedRows: number;
  readonly acknowledgedInvalidRows: boolean;
  readonly acknowledgedFailedRows: boolean;
}): "batch_not_reviewable" | "invalid_rows_not_acknowledged" | "failed_rows_not_acknowledged" | null {
  if (!canTransitionImportBatch(input.status, "closed")) {
    return "batch_not_reviewable";
  }
  if (input.invalidRows > 0 && !input.acknowledgedInvalidRows) {
    return "invalid_rows_not_acknowledged";
  }
  if (input.failedRows > 0 && !input.acknowledgedFailedRows) {
    return "failed_rows_not_acknowledged";
  }
  return null;
}
