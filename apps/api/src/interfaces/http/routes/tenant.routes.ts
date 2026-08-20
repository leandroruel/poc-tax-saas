import type { FastifyInstance, FastifyReply } from "fastify";
import type {
  AuthenticateRequest,
  AuthenticatedActor,
} from "../../../application/ports/authenticator.js";
import type { TenantQueries } from "../../../application/ports/tenant-queries.js";
import type { AuthenticateUser } from "../../../application/ports/user-authenticator.js";

async function requireTenant(
  authenticate: AuthenticateRequest,
  headers: Parameters<AuthenticateRequest>[0],
  reply: FastifyReply,
): Promise<AuthenticatedActor | null> {
  const actor = await authenticate(headers);
  if (!actor) reply.status(401).send({ error: "unauthenticated" });
  return actor;
}

export function registerTenantRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  authenticateUser: AuthenticateUser,
  queries: TenantQueries,
) {
  app.get("/api/me", async (request, reply) => {
    const user = await authenticateUser(request.headers);
    if (!user) return reply.status(401).send({ error: "unauthenticated" });
    return queries.userContext(user.userId);
  });
  app.get("/api/dashboard", async (request, reply) => {
    const actor = await requireTenant(authenticate, request.headers, reply);
    if (!actor) return;
    return queries.overview(actor.tenantId);
  });
  app.get("/api/calculations", async (request, reply) => {
    const actor = await requireTenant(authenticate, request.headers, reply);
    if (!actor) return;
    return queries.calculations(actor.tenantId);
  });
  app.get<{ Params: { calculationId: string } }>(
    "/api/calculations/:calculationId",
    async (request, reply) => {
      const actor = await requireTenant(authenticate, request.headers, reply);
      if (!actor) return;
      const calculation = await queries.getCalculation(
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
    const actor = await requireTenant(authenticate, request.headers, reply);
    if (!actor) return;
    return queries.company(actor.tenantId);
  });
}
