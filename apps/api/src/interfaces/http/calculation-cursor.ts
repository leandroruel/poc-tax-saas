import { z } from "zod";
import type { CalculationCursor } from "../../application/read-models/calculation-record.js";

const cursorPayloadSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    id: z.string().min(1).max(100),
  })
  .strict();

export function encodeCalculationCursor(cursor: CalculationCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCalculationCursor(value: string): CalculationCursor {
  const decoded: unknown = JSON.parse(
    Buffer.from(value, "base64url").toString("utf8"),
  );
  return cursorPayloadSchema.parse(decoded);
}
