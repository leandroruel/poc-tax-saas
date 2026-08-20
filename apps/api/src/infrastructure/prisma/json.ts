import { Prisma } from "@prisma/client";
import { moneyToDecimal, type Money } from "../../domain/shared/money.js";

export type JsonValue = Prisma.InputJsonValue | null;

export function jsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return moneyToDecimal(value as Money);
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") return jsonObject(value);
  throw new Error(`Unsupported JSON value: ${typeof value}`);
}

/**
 * Produces Prisma-compatible JSON with deterministic key ordering. Besides
 * avoiding bigint serialization failures, the stable order makes audit hashes
 * independent from JavaScript object insertion order.
 */
export function jsonObject(value: object): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, jsonValue(nested)]),
  ) as Prisma.InputJsonObject;
}

export function canonicalJson(value: object): string {
  return JSON.stringify(jsonObject(value));
}
