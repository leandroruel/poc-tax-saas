const CNPJ_BODY = /^[A-Z0-9]{12}\d{2}$/;
const FIRST_CHECK_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const SECOND_CHECK_DIGIT_WEIGHTS = [
  6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2,
] as const;

export class InvalidCnpjError extends Error {
  constructor() {
    super("CNPJ inválido");
    this.name = "InvalidCnpjError";
  }
}

function characterValue(character: string): number {
  return character.charCodeAt(0) - 48;
}

function checkDigit(value: string, weights: readonly number[]): number {
  const total = [...value].reduce(
    (sum, character, index) =>
      sum + characterValue(character) * weights[index]!,
    0,
  );
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function parseCnpj(input: string): string {
  const normalized = input
    .trim()
    .toUpperCase()
    .replace(/[.\-/\s]/g, "");
  if (!CNPJ_BODY.test(normalized) || /^(\d)\1{13}$/.test(normalized)) {
    throw new InvalidCnpjError();
  }

  const body = normalized.slice(0, 12);
  const firstDigit = checkDigit(body, FIRST_CHECK_DIGIT_WEIGHTS);
  const secondDigit = checkDigit(
    `${body}${firstDigit}`,
    SECOND_CHECK_DIGIT_WEIGHTS,
  );
  if (normalized.slice(12) !== `${firstDigit}${secondDigit}`)
    throw new InvalidCnpjError();

  return normalized;
}
