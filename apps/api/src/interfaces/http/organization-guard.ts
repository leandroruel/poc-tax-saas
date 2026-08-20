import type { FastifyReply } from "fastify";
import type {
  AuthenticateRequest,
  AuthenticatedActor,
} from "../../application/ports/authenticator.js";
import {
  can,
  type OrganizationPermission,
} from "../../domain/tenancy/organization-access.js";

export async function requireOrganizationPermission(
  authenticate: AuthenticateRequest,
  headers: Parameters<AuthenticateRequest>[0],
  reply: FastifyReply,
  permission: OrganizationPermission,
): Promise<AuthenticatedActor | null> {
  const actor = await authenticate(headers);
  if (!actor) {
    await reply.status(401).send({ error: "unauthenticated" });
    return null;
  }
  if (!can(actor.organizationRole, permission)) {
    await reply.status(403).send({ error: "forbidden" });
    return null;
  }
  return actor;
}
