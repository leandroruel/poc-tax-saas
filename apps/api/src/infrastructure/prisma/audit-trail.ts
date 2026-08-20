import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AuditCategory,
  AuditEventView,
  AuditTrail,
} from "../../application/ports/audit-trail.js";

const actionPrefixByCategory = {
  calculations: "calculation.",
  imports: "import.",
  exports: "calculation_export.",
  jobs: "background_job.",
  organization: "organization.",
} as const satisfies Record<AuditCategory, string>;

const auditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  occurredAt: true,
  actor: { select: { id: true, name: true } },
} as const satisfies Prisma.AuditLogSelect;

type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;

function categoryOf(action: string): AuditCategory {
  const category = Object.entries(actionPrefixByCategory).find(([, prefix]) =>
    action.startsWith(prefix),
  )?.[0];
  return (category as AuditCategory | undefined) ?? "organization";
}

function eventView(row: AuditRow): AuditEventView {
  return {
    ...row,
    category: categoryOf(row.action),
    occurredAt: row.occurredAt.toISOString(),
  };
}

export function createPrismaAuditTrail(prisma: PrismaClient): AuditTrail {
  return {
    async list(input) {
      const and: Prisma.AuditLogWhereInput[] = [];
      if (input.category) {
        and.push({
          action: { startsWith: actionPrefixByCategory[input.category] },
        });
      }
      if (input.cursor) {
        const occurredAt = new Date(input.cursor.occurredAt);
        and.push({
          OR: [
            { occurredAt: { lt: occurredAt } },
            { occurredAt, id: { lt: input.cursor.id } },
          ],
        });
      }
      const rows = await prisma.auditLog.findMany({
        where: {
          organizationId: input.tenantId,
          ...(and.length ? { AND: and } : {}),
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        select: auditSelect,
      });
      const hasNextPage = rows.length > input.limit;
      const items = rows.slice(0, input.limit).map(eventView);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          hasNextPage && last
            ? { occurredAt: last.occurredAt, id: last.id }
            : null,
      };
    },
  };
}
