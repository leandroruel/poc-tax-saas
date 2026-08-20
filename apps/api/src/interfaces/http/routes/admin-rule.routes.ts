import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  serializedTaxTreatmentSchema,
  toDomainTaxTreatment,
} from "../../../application/codecs/tax-treatment-codec.js";
import { businessDateInBrazil } from "../../../application/time/business-calendar.js";
import type {
  AuthenticateUser,
  AuthenticatedUser,
} from "../../../application/ports/user-authenticator.js";
import type { RuleAdministration } from "../../../application/ports/rule-administration.js";
import { isLocalDate } from "../../../domain/iof/operation.js";

const localDate = z.string().refine(isLocalDate, "data inválida");
const draftSchema = z
  .object({
    ruleCode: z.string().regex(/^IOF_[A-Z0-9_]+$/),
    operationType: z.enum(["credit_pj_principal_defined", "insurance_vgbl"]),
    effectiveFrom: localDate,
    effectiveTo: localDate.nullable(),
    treatment: serializedTaxTreatmentSchema,
    legalBasis: z.string().min(5),
    sourceUrl: z.url(),
    changeReason: z.string().min(5),
  })
  .strict()
  .refine(
    (value) =>
      value.effectiveTo === null || value.effectiveFrom < value.effectiveTo,
    { message: "effectiveTo must be after effectiveFrom" },
  );
const transitionSchema = z
  .object({ action: z.enum(["submit", "approve", "reject", "revoke"]) })
  .strict();

async function requireAdmin(
  authenticate: AuthenticateUser,
  headers: Parameters<AuthenticateUser>[0],
  reply: FastifyReply,
): Promise<AuthenticatedUser | null> {
  const actor = await authenticate(headers);
  if (!actor) {
    reply.status(401).send({ error: "unauthenticated" });
    return null;
  }
  if (!actor.isPlatformAdmin) {
    reply.status(403).send({ error: "forbidden" });
    return null;
  }
  return actor;
}

export function registerAdminRuleRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateUser,
  rules: RuleAdministration,
) {
  app.get("/api/admin/rules", async (request, reply) => {
    if (!(await requireAdmin(authenticate, request.headers, reply))) return;
    return rules.list(businessDateInBrazil());
  });
  app.get("/api/admin/audit", async (request, reply) => {
    if (!(await requireAdmin(authenticate, request.headers, reply))) return;
    return rules.audit();
  });
  app.post("/api/admin/rules/versions", async (request, reply) => {
    const actor = await requireAdmin(authenticate, request.headers, reply);
    if (!actor) return;
    const parsed = draftSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({
          error: "invalid_request",
          details: z.flattenError(parsed.error),
        });
    return reply.status(201).send(
      await rules.createDraft({
        actorUserId: actor.userId,
        ...parsed.data,
        treatment: toDomainTaxTreatment(parsed.data.treatment),
      }),
    );
  });
  app.post(
    "/api/admin/rules/versions/:versionId/transition",
    async (request, reply) => {
      const actor = await requireAdmin(authenticate, request.headers, reply);
      if (!actor) return;
      const params = z
        .object({ versionId: z.string().min(1) })
        .parse(request.params);
      const body = transitionSchema.safeParse(request.body);
      if (!body.success)
        return reply.status(400).send({ error: "invalid_request" });
      try {
        await rules.transition({
          actorUserId: actor.userId,
          versionId: params.versionId,
          action: body.data.action,
        });
        return reply.status(204).send();
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "InvalidRuleTransitionError" ||
            error.message === "rule_period_overlap")
        ) {
          return reply
            .status(409)
            .send({ error: "invalid_rule_transition", message: error.message });
        }
        throw error;
      }
    },
  );
}
