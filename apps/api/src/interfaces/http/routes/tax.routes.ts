import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CalculateTax } from "../../../application/calculate-tax.js";
import { isMoneyNumber, moneyFromNumber } from "../../../domain/money.js";
import type { TaxOperation } from "../../../domain/operation.js";
import { presentCalculation } from "../tax-presenter.js";

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), "invalid date");

const moneySchema = z
  .number()
  .positive()
  .finite()
  .safe()
  .refine(isMoneyNumber, "must have at most two decimal places");

const nonNegativeMoneySchema = z
  .number()
  .nonnegative()
  .finite()
  .safe()
  .refine(isMoneyNumber, "must have at most two decimal places");

const partySchema = z.object({
  personType: z.enum(["PF", "PJ"]),
  category: z.literal("simples_mei").optional(),
});

const operationBase = {
  date: localDateSchema,
  baseAmount: moneySchema,
};

const operationSchema = z.discriminatedUnion("type", [
  z.object({
    ...operationBase,
    type: z.literal("credit"),
    borrower: partySchema,
    termInDays: z.number().int().positive(),
    optedIntoSimples: z.boolean().default(false),
  }),
  z.object({
    ...operationBase,
    type: z.literal("insurance"),
    product: z.enum(["vgbl", "life_survival"]),
    insured: partySchema,
    payer: z.enum(["policyholder", "employer"]),
    priorContributions: z
      .object({
        sameInsurer: nonNegativeMoneySchema.optional(),
        allInsurers: nonNegativeMoneySchema.optional(),
      })
      .default({}),
  }),
  z.object({
    ...operationBase,
    type: z.literal("foreign_exchange"),
    direction: z.enum(["outflow", "inflow", "investment"]),
  }),
  z.object({
    ...operationBase,
    type: z.literal("investment"),
    instrument: z.literal("fidc"),
    market: z.enum(["primary", "secondary"]),
  }),
]);

const requestSchema = z.object({
  tenantId: z.string().min(1),
  asOfDate: localDateSchema,
  taxType: z.literal("IOF").default("IOF"),
  operation: operationSchema,
});

function toDomainOperation(operation: z.infer<typeof operationSchema>): TaxOperation {
  const base = { occurredOn: operation.date, amount: moneyFromNumber(operation.baseAmount) };
  if (operation.type === "credit") {
    return {
      ...base,
      kind: "credit",
      borrower: operation.borrower,
      termInDays: operation.termInDays,
      optedIntoSimples: operation.optedIntoSimples,
    };
  }
  if (operation.type === "insurance") {
    return {
      ...base,
      kind: "insurance",
      product: operation.product,
      insured: operation.insured,
      payer: operation.payer,
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
  if (operation.type === "foreign_exchange") {
    return { ...base, kind: "foreign_exchange", direction: operation.direction };
  }
  return { ...base, kind: "investment", instrument: operation.instrument, market: operation.market };
}

function httpStatus(kind: Awaited<ReturnType<CalculateTax>>["outcome"]["kind"]): number {
  if (kind === "calculated" || kind === "calculated_with_warning" || kind === "not_applicable") return 200;
  if (kind === "unclassified") return 400;
  if (kind === "ambiguous_rule") return 500;
  return 422;
}

export function registerTaxRoutes(app: FastifyInstance, calculateTax: CalculateTax) {
  app.post("/tax/calculate", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const response = await calculateTax({
      tenantId: parsed.data.tenantId,
      taxType: parsed.data.taxType,
      asOf: parsed.data.asOfDate,
      operation: toDomainOperation(parsed.data.operation),
    });
    return reply
      .status(httpStatus(response.outcome.kind))
      .send(presentCalculation(response.calculationId, response.outcome));
  });
}
