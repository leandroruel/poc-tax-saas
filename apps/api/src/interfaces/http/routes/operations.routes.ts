import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import type { OperationalQueries } from "../../../application/ports/operational-queries.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function registerOperationsRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  queries: OperationalQueries,
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
}
