import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CalculationExportNotReadyError,
  type CalculationExportWorkflow,
} from "../../../application/calculation-exports.js";
import { calculationExportColumns } from "../../../application/exports/calculation-export.js";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import {
  calculationOperationTypes,
  calculationStatuses,
} from "../../../application/read-models/calculation-record.js";
import { isLocalDate } from "../../../domain/iof/operation.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const localDateSchema = z.string().refine(isLocalDate, "invalid local date");
const filtersSchema = z
  .object({
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
const requestSchema = z
  .object({
    format: z.enum(["csv", "evidence_json"]),
    columns: z.array(z.enum(calculationExportColumns)).min(1).max(20).optional(),
    delimiter: z.enum([",", ";"]).optional(),
    filters: filtersSchema.default({}),
  })
  .strict();
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function attachmentHeader(fileName: string): string {
  const safe = fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
  return `attachment; filename="${safe}"`;
}

export function registerCalculationExportRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  workflow: CalculationExportWorkflow,
) {
  app.post("/api/calculation-exports", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "export:create",
    );
    if (!actor) return;
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        details: z.flattenError(parsed.error),
      });
    }
    const result = await workflow.request({
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      ...parsed.data,
    });
    return reply.status(202).send(result);
  });

  app.get("/api/calculation-exports", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "export:read",
    );
    if (!actor) return;
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    return workflow.list(actor.tenantId, parsed.data.limit);
  });

  app.get<{ Params: { exportId: string } }>(
    "/api/calculation-exports/:exportId/download",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "export:read",
      );
      if (!actor) return;
      try {
        const artifact = await workflow.download({
          tenantId: actor.tenantId,
          exportId: request.params.exportId,
        });
        if (!artifact) {
          return reply.status(404).send({ error: "calculation_export_not_ready" });
        }
        return reply
          .header("Content-Type", artifact.contentType)
          .header("Content-Disposition", attachmentHeader(artifact.fileName))
          .header("Cache-Control", "private, no-store")
          .send(Buffer.from(artifact.bytes));
      } catch (error) {
        if (error instanceof CalculationExportNotReadyError) {
          return reply.status(409).send({ error: "calculation_export_object_missing" });
        }
        throw error;
      }
    },
  );
}
