export class CalculationRevisionSourceNotFoundError extends Error {
  readonly name = "CalculationRevisionSourceNotFoundError";

  constructor(readonly calculationId: string) {
    super("The calculation selected for revision does not belong to this organization.");
  }
}

export class CalculationImportRowNotFoundError extends Error {
  readonly name = "CalculationImportRowNotFoundError";

  constructor(readonly rowId: string) {
    super("The import row is unavailable for calculation in this organization.");
  }
}
