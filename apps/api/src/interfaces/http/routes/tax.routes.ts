import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CalculateTax } from "../../../application/calculate-tax.js";
import { CalculationRevisionSourceNotFoundError } from "../../../application/calculation-errors.js";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import type { IofOperation } from "../../../domain/iof/operation.js";
import { isLocalDate } from "../../../domain/iof/operation.js";
import {
  isMoneyNumber,
  moneyFromNumber,
} from "../../../domain/shared/money.js";
import { presentCalculation } from "../tax-presenter.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const localDateSchema = z.string().refine(isLocalDate, "data inválida");
const moneySchema = z
  .number()
  .positive()
  .finite()
  .safe()
  .refine(isMoneyNumber, "use no máximo 2 casas decimais");
const nonNegativeMoneySchema = z
  .number()
  .nonnegative()
  .finite()
  .safe()
  .refine(isMoneyNumber, "use no máximo 2 casas decimais");

const operationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("credit"),
      modality: z.literal("principal_defined"),
      occurredOn: localDateSchema,
      amount: moneySchema,
      borrower: z.object({ personType: z.literal("PJ") }).strict(),
      termInDays: z.number().int().positive().safe(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("vgbl"),
      occurredOn: localDateSchema,
      amount: moneySchema,
      insured: z.object({ personType: z.literal("PF") }).strict(),
      payer: z.enum(["policyholder", "employer"]),
      priorContributions: z
        .object({
          sameInsurer: nonNegativeMoneySchema.optional(),
          allInsurers: nonNegativeMoneySchema.optional(),
        })
        .strict()
        .default({}),
    })
    .strict(),
]);

const requestSchema = z
  .object({
    operation: operationSchema,
    recalculatesId: z.uuid().optional(),
  })
  .strict();

function toDomainOperation(
  operation: z.infer<typeof operationSchema>,
): IofOperation {
  const base = {
    occurredOn: operation.occurredOn,
    amount: moneyFromNumber(operation.amount),
  };
  if (operation.kind === "credit") return { ...operation, ...base };
  return {
    ...operation,
    ...base,
    priorContributions: {
      sameInsurer:
        operation.priorContributions.sameInsurer === undefined
          ? undefined
          : moneyFromNumber(operation.priorContributions.sameInsurer),
      allInsurers:
        operation.priorContributions.allInsurers === undefined
          ? undefined
          : moneyFromNumber(operation.priorContributions.allInsurers),
    },
  };
}

export function registerTaxRoutes(
  app: FastifyInstance,
  calculateTax: CalculateTax,
  authenticate: AuthenticateRequest,
) {
  app.post("/tax/calculate", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "calculation:create",
    );
    if (!actor) return;

    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({
          error: "invalid_request",
          details: z.flattenError(parsed.error),
        });
    }

    let response;
    try {
      response = await calculateTax({
        actorUserId: actor.userId,
        tenant: { id: actor.tenantId, segment: actor.segment },
        operation: toDomainOperation(parsed.data.operation),
        recalculatesId: parsed.data.recalculatesId,
      });
    } catch (error) {
      if (error instanceof CalculationRevisionSourceNotFoundError) {
        return reply.status(404).send({
          error: "calculation_revision_source_not_found",
        });
      }
      throw error;
    }
    const status =
      response.outcome.kind === "ambiguous_rule"
        ? 409
        : response.outcome.kind === "unsupported"
          ? 403
        : response.outcome.kind === "calculated" ||
            response.outcome.kind === "not_applicable"
          ? 200
          : 422;
    return reply
      .status(status)
      .send(presentCalculation(response.calculationId, response.outcome));
  });
}
