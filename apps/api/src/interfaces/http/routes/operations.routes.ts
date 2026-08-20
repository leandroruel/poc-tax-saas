import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import type { OperationalQueries } from "../../../application/ports/operational-queries.js";
import type { BackgroundJobOperations } from "../../../application/ports/background-job-operations.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function registerOperationsRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  queries: OperationalQueries,
  jobOperations: BackgroundJobOperations,
) {
  app.get("/api/notifications", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "notification:read",
    );
    if (!actor) return;
    const parsed = limitSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request" });
    }
    return queries.notifications({
      tenantId: actor.tenantId,
      userId: actor.userId,
      limit: parsed.data.limit,
    });
  });

  app.post<{ Params: { notificationId: string } }>(
    "/api/notifications/:notificationId/read",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "notification:read",
      );
      if (!actor) return;
      const found = await queries.markNotificationRead({
        tenantId: actor.tenantId,
        userId: actor.userId,
        notificationId: request.params.notificationId,
      });
      return found
        ? reply.status(204).send()
        : reply.status(404).send({ error: "notification_not_found" });
    },
  );

  app.get("/api/jobs", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "job:read",
    );
    if (!actor) return;
    const parsed = limitSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request" });
    }
    return queries.jobs(actor.tenantId, parsed.data.limit);
  });

  app.post<{ Params: { jobId: string } }>(
    "/api/jobs/:jobId/retry",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "job:retry",
      );
      if (!actor) return;
      const result = await jobOperations.retry({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        jobId: request.params.jobId,
      });
      if (result.kind === "not_found") {
        return reply.status(404).send({ error: "background_job_not_found" });
      }
      if (result.kind === "not_retryable") {
        return reply.status(409).send({
          error: "background_job_not_retryable",
          reason: result.reason,
        });
      }
      return reply.status(202).send({ status: "queued" });
    },
  );
}
