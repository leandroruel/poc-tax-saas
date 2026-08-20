import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import type { TeamManagement } from "../../../application/ports/team-management.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const roleSchema = z.object({ role: z.enum(["admin", "operator", "reviewer"]) }).strict();

export function registerTeamRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  team: TeamManagement,
) {
  app.patch<{ Params: { memberId: string } }>(
    "/api/team/members/:memberId/role",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "team:manage",
      );
      if (!actor) return;
      const body = roleSchema.safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: "invalid_request" });
      const result = await team.updateRole({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        memberId: request.params.memberId,
        role: body.data.role,
      });
      if (result === "not_found") return reply.status(404).send({ error: "member_not_found" });
      if (result === "protected_member") return reply.status(409).send({ error: "protected_member" });
      return reply.status(204).send();
    },
  );

  app.delete<{ Params: { memberId: string } }>(
    "/api/team/members/:memberId",
    async (request, reply) => {
      const actor = await requireOrganizationPermission(
        authenticate,
        request.headers,
        reply,
        "team:manage",
      );
      if (!actor) return;
      const result = await team.remove({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        memberId: request.params.memberId,
      });
      if (result === "not_found") return reply.status(404).send({ error: "member_not_found" });
      if (result === "protected_member") return reply.status(409).send({ error: "protected_member" });
      return reply.status(204).send();
    },
  );
}
