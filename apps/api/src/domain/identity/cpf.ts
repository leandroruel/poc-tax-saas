export class InvalidCpfError extends Error {
  constructor() {
    super("CPF inválido");
    this.name = "InvalidCpfError";
  }
}

function expectedDigit(digits: readonly number[], factor: number): number {
  const total = digits.reduce((sum, digit) => sum + digit * factor--, 0);
  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function parseCpf(input: string): string {
  if (!/^[\d.\-\s]+$/.test(input)) throw new InvalidCpfError();
  const normalized = input.replace(/\D/g, "");
  if (!/^\d{11}$/.test(normalized) || /^(\d)\1{10}$/.test(normalized)) {
    throw new InvalidCpfError();
  }
  const digits = [...normalized].map(Number);
  if (
    digits[9] !== expectedDigit(digits.slice(0, 9), 10) ||
    digits[10] !== expectedDigit(digits.slice(0, 10), 11)
  ) {
    throw new InvalidCpfError();
  }
  return normalized;
}
