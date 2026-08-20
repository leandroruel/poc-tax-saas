import type { PrismaClient } from "@prisma/client";
import type { OperationalQueries } from "../../application/ports/operational-queries.js";

export function createPrismaOperationalQueries(
  prisma: PrismaClient,
): OperationalQueries {
  return {
    async notifications({ tenantId, userId, limit }) {
      const where = { organizationId: tenantId, userId };
      const [items, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit,
        }),
        prisma.notification.count({ where: { ...where, readAt: null } }),
      ]);
      return {
        items: items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          entityType: item.entityType,
          entityId: item.entityId,
          createdAt: item.createdAt.toISOString(),
          readAt: item.readAt?.toISOString() ?? null,
        })),
        unreadCount,
      };
    },
    async markNotificationRead({ tenantId, userId, notificationId }) {
      const result = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          organizationId: tenantId,
          userId,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      if (result.count > 0) return true;
      return (
        (await prisma.notification.count({
          where: { id: notificationId, organizationId: tenantId, userId },
        })) > 0
      );
    },
    async jobs(tenantId, limit) {
      const jobs = await prisma.backgroundJob.findMany({
        where: { organizationId: tenantId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      });
      return jobs.map((job) => ({
        id: job.id,
        batchId: job.batchId,
        type: job.type,
        status: job.status,
        progress: {
          current: job.progressCurrent,
          total: job.progressTotal,
        },
        attemptsMade: job.attemptsMade,
        maxAttempts: job.maxAttempts,
        correlationId: job.correlationId,
        lastErrorCode: job.lastErrorCode,
        lastErrorMessage: job.lastErrorMessage,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      }));
    },
  };
}
