export class CalculationRevisionSourceNotFoundError extends Error {
  readonly name = "CalculationRevisionSourceNotFoundError";

  constructor(readonly calculationId: string) {
    super("The calculation selected for revision does not belong to this organization.");
  }
}
