import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { OnboardCompany } from "../../../application/onboard-company.js";
import type { AuthenticateUser } from "../../../application/ports/user-authenticator.js";

const onboardingSchema = z
  .object({
    cpf: z.string().min(11).max(14),
    company: z
      .object({
        name: z.string().trim().min(2).max(120),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(80),
        cnpj: z.string().min(14).max(20),
        segment: z.enum(["credit_provider", "insurance_pension"]),
      })
      .strict(),
  })
  .strict();

export function registerOnboardingRoutes(
  app: FastifyInstance,
  authenticateUser: AuthenticateUser,
  onboardCompany: OnboardCompany,
) {
  app.post("/api/onboarding", async (request, reply) => {
    const actor = await authenticateUser(request.headers);
    if (!actor) return reply.status(401).send({ error: "unauthenticated" });

    const parsed = onboardingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({
          error: "invalid_request",
          details: z.flattenError(parsed.error),
        });
    }
    try {
      const result = await onboardCompany({ ...actor, ...parsed.data });
      return reply.status(201).send(result);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return reply.status(409).send({ error: "onboarding_conflict" });
      }
      if (
        error instanceof Error &&
        (error.name === "InvalidCpfError" || error.name === "InvalidCnpjError")
      ) {
        return reply.status(400).send({ error: "invalid_tax_id" });
      }
      throw error;
    }
  });
}
