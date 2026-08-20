import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  DuplicateImportFileError,
  ImportBatchConflictError,
  ImportBatchNotFoundError,
  type ImportBatchWorkflow,
} from "../../../application/import-batches.js";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import { InvalidCsvError } from "../../../domain/operations/csv.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const mappingBase = {
  dateFormat: z.enum(["yyyy-mm-dd", "dd/mm/yyyy"]),
  numberFormat: z.enum(["decimal_dot", "decimal_comma"]),
};
const mappingSchema = z.discriminatedUnion("operationType", [
  z.object({
    ...mappingBase,
    operationType: z.literal("credit_pj_principal_defined"),
    columns: z.object({
      occurredOn: z.string().min(1),
      amount: z.string().min(1),
      termInDays: z.string().min(1),
    }),
  }),
  z.object({
    ...mappingBase,
    operationType: z.literal("insurance_vgbl"),
    columns: z.object({
      occurredOn: z.string().min(1),
      amount: z.string().min(1),
      payer: z.string().min(1),
      priorSameInsurer: z.string().min(1).optional(),
      priorAllInsurers: z.string().min(1).optional(),
    }),
  }),
]);
const configureSchema = z.object({
  mapping: mappingSchema,
  profileName: z.string().trim().min(1).max(80).optional(),
});
const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function sendImportError(error: unknown, reply: FastifyReply) {
  if (error instanceof ImportBatchNotFoundError) {
    return reply.status(404).send({ error: "import_batch_not_found" });
  }
  if (error instanceof DuplicateImportFileError) {
    return reply.status(409).send({
      error: "duplicate_import_file",
      existingBatchId: error.existingBatchId,
    });
  }
  if (error instanceof ImportBatchConflictError || error instanceof InvalidCsvError) {
    return reply.status(409).send({ error: error.message });
  }
  throw error;
}

export function registerImportBatchRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  workflow: ImportBatchWorkflow,
) {
  app.post("/api/import-batches", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "batch:create",
    );
    if (!actor) return;
    try {
      const file = await request.file({ limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
      if (!file || !file.filename.toLowerCase().endsWith(".csv")) {
        return reply.status(400).send({ error: "csv_file_required" });
      }
      const batch = await workflow.upload({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        fileName: file.filename.slice(0, 255),
        contentType: file.mimetype || "text/csv",
        bytes: await file.toBuffer(),
      });
      return reply.status(201).send(batch);
    } catch (error) {
      return sendImportError(error, reply);
    }
  });

  app.get("/api/import-batches", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "batch:read",
    );
    if (!actor) return;
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    return workflow.list(actor.tenantId, parsed.data.limit);
  });

  app.get<{ Params: { batchId: string } }>(
    "/api/import-batches/:batchId",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "batch:read",
      );
      if (!actor) return;
      const batch = await workflow.get(actor.tenantId, request.params.batchId);
      return batch
        ? reply.send(batch)
        : reply.status(404).send({ error: "import_batch_not_found" });
    },
  );

  app.post<{ Params: { batchId: string } }>(
    "/api/import-batches/:batchId/validate",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "batch:create",
      );
      if (!actor) return;
      const parsed = configureSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await workflow.configure({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          segment: actor.segment,
          batchId: request.params.batchId,
          ...parsed.data,
        });
        return reply.status(202).send(result);
      } catch (error) {
        return sendImportError(error, reply);
      }
    },
  );

  app.post<{ Params: { batchId: string } }>(
    "/api/import-batches/:batchId/process",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "batch:create",
      );
      if (!actor) return;
      try {
        const result = await workflow.process({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          batchId: request.params.batchId,
        });
        return reply.status(202).send(result);
      } catch (error) {
        return sendImportError(error, reply);
      }
    },
  );

}
