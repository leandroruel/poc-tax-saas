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
  validating: ["ready", "failed", "cancelled"],
  ready: ["processing", "cancelled"],
  processing: ["requires_review", "failed", "cancelled"],
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
