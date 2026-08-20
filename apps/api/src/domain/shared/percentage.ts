import type { Money } from "./money.js";

export type Percentage = string;

function ratioOf(percentage: Percentage): {
  numerator: bigint;
  denominator: bigint;
} {
  if (!/^\d+(?:\.\d+)?$/.test(percentage)) {
    throw new Error(`Invalid percentage: ${percentage}`);
  }
  const [whole, fraction = ""] = percentage.split(".");
  const scale = 10n ** BigInt(fraction.length);
  return {
    numerator: BigInt(whole) * scale + BigInt(fraction || "0"),
    denominator: scale * 100n,
  };
}

/** Applies a percentage and rounds half-up to the nearest cent. */
export function applyPercentage(
  base: Money,
  percentage: Percentage,
  multiplier = 1,
): Money {
  if (!Number.isSafeInteger(multiplier) || multiplier < 0) {
    throw new RangeError("Percentage multiplier must be a non-negative safe integer.");
  }
  const ratio = ratioOf(percentage);
  const numerator = base * ratio.numerator * BigInt(multiplier);
  return ((numerator + ratio.denominator / 2n) / ratio.denominator) as Money;
}
