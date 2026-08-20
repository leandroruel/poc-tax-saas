import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import type { CalculationLedger } from "../../../application/ports/calculation-ledger.js";
import {
  calculationOperationTypes,
  calculationStatuses,
} from "../../../application/read-models/calculation-record.js";
import { isLocalDate } from "../../../domain/iof/operation.js";
import type { TenantQueries } from "../../../application/ports/tenant-queries.js";
import type { AuthenticateUser } from "../../../application/ports/user-authenticator.js";
import {
  decodeCalculationCursor,
  encodeCalculationCursor,
} from "../calculation-cursor.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const localDateSchema = z.string().refine(isLocalDate, "invalid local date");
const listCalculationsSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    calculationId: z.string().min(1).max(100).optional(),
    operationType: z.enum(calculationOperationTypes).optional(),
    status: z.enum(calculationStatuses).optional(),
    occurredFrom: localDateSchema.optional(),
    occurredTo: localDateSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.occurredFrom ||
      !value.occurredTo ||
      value.occurredFrom <= value.occurredTo,
    { message: "invalid date range", path: ["occurredTo"] },
  );

export function registerTenantRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  authenticateUser: AuthenticateUser,
  queries: TenantQueries,
  calculationLedger: CalculationLedger,
) {
  app.get("/api/me", async (request, reply) => {
    const user = await authenticateUser(request.headers);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    return queries.userContext(user.userId);
  });
  app.get("/api/dashboard", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "dashboard:read",
    );
    if (!actor) return;
    return calculationLedger.overview(actor.tenantId);
  });
  app.get("/api/calculations", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "calculation:read",
    );
    if (!actor) return;
    const parsed = listCalculationsSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        details: z.flattenError(parsed.error),
      });
    }
    let cursor;
    try {
      cursor = parsed.data.cursor
        ? decodeCalculationCursor(parsed.data.cursor)
        : undefined;
    } catch {
      return reply.status(400).send({ error: "invalid_cursor" });
    }
    const page = await calculationLedger.list(actor.tenantId, {
      ...parsed.data,
      cursor,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor
        ? encodeCalculationCursor(page.nextCursor)
        : null,
    };
  });
  app.get<{ Params: { calculationId: string } }>(
    "/api/calculations/:calculationId",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "calculation:read",
      );
      if (!actor) return;
      const calculation = await calculationLedger.get(
        actor.tenantId,
        request.params.calculationId,
      );
      return (
        calculation ??
        reply.status(404).send({ error: "calculation_not_found" })
      );
    },
  );
  app.get("/api/company", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "company:read",
    );
    if (!actor) return;
    return queries.company(actor.tenantId);
  });
}
