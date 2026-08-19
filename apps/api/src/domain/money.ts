export type Money = bigint & { readonly __brand: "Money" };

const MONEY_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

export function reais(value: string): Money {
  const match = MONEY_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid BRL amount: ${value}`);

  const [, whole, fraction = ""] = match;
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) as Money;
}

export function isMoneyNumber(value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;

  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && cents / 100 === value;
}

export function moneyFromNumber(value: number): Money {
  if (!isMoneyNumber(value)) throw new Error(`Invalid BRL amount: ${value}`);
  return BigInt(Math.round(value * 100)) as Money;
}

export function moneyToNumber(value: Money): number {
  return Number(value) / 100;
}

export function moneyToDecimal(value: Money): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}
