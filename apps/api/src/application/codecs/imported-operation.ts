import { isLocalDate, type IofOperation } from "../../domain/iof/operation.js";
import { reais } from "../../domain/shared/money.js";

export function decodeImportedOperation(value: unknown): IofOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid imported operation.");
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.occurredOn !== "string" ||
    !isLocalDate(input.occurredOn) ||
    typeof input.amount !== "string"
  ) {
    throw new Error("Invalid imported operation fields.");
  }
  const amount = reais(input.amount);
  if (input.kind === "credit") {
    if (
      input.modality !== "principal_defined" ||
      !Number.isSafeInteger(input.termInDays) ||
      Number(input.termInDays) <= 0
    ) {
      throw new Error("Invalid imported credit operation.");
    }
    return {
      kind: "credit",
      modality: "principal_defined",
      occurredOn: input.occurredOn,
      amount,
      borrower: { personType: "PJ" },
      termInDays: Number(input.termInDays),
    };
  }
  if (input.kind === "vgbl") {
    if (input.payer !== "policyholder" && input.payer !== "employer") {
      throw new Error("Invalid imported VGBL payer.");
    }
    const prior =
      input.priorContributions &&
      typeof input.priorContributions === "object" &&
      !Array.isArray(input.priorContributions)
        ? (input.priorContributions as Record<string, unknown>)
        : {};
    return {
      kind: "vgbl",
      occurredOn: input.occurredOn,
      amount,
      insured: { personType: "PF" },
      payer: input.payer,
      priorContributions: {
        sameInsurer:
          typeof prior.sameInsurer === "string"
            ? reais(prior.sameInsurer)
            : undefined,
        allInsurers:
          typeof prior.allInsurers === "string"
            ? reais(prior.allInsurers)
            : undefined,
      },
    };
  }
  throw new Error("Unsupported imported operation kind.");
}
