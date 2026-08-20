import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  auditCategories,
  type AuditTrail,
} from "../../../application/ports/audit-trail.js";
import type { AuthenticateRequest } from "../../../application/ports/authenticator.js";
import { decodeAuditCursor, encodeAuditCursor } from "../audit-cursor.js";
import { requireOrganizationPermission } from "../organization-guard.js";

const listAuditSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    category: z.enum(auditCategories).optional(),
    cursor: z.string().optional(),
  })
  .strict();

export function registerAuditRoutes(
  app: FastifyInstance,
  authenticate: AuthenticateRequest,
  auditTrail: AuditTrail,
) {
  app.get("/api/audit-events", async (request, reply) => {
    const actor = await requireOrganizationPermission(
      authenticate,
      request.headers,
      reply,
      "audit:read",
    );
    if (!actor) return;
    const parsed = listAuditSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid_request" });
    }
    let cursor;
    try {
      cursor = parsed.data.cursor
        ? decodeAuditCursor(parsed.data.cursor)
        : undefined;
    } catch {
      return reply.status(400).send({ error: "invalid_cursor" });
    }
    const page = await auditTrail.list({
      tenantId: actor.tenantId,
      limit: parsed.data.limit,
      category: parsed.data.category,
      cursor,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor
        ? encodeAuditCursor(page.nextCursor)
        : null,
    };
  });
}
