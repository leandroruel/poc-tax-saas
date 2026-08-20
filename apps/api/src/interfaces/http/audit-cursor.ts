import { z } from "zod";
import type { AuditCursor } from "../../application/ports/audit-trail.js";

const cursorPayloadSchema = z
  .object({
    occurredAt: z.iso.datetime({ offset: true }),
    id: z.string().min(1).max(100),
  })
  .strict();

export function encodeAuditCursor(cursor: AuditCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeAuditCursor(value: string): AuditCursor {
  const decoded: unknown = JSON.parse(
    Buffer.from(value, "base64url").toString("utf8"),
  );
  return cursorPayloadSchema.parse(decoded);
}
