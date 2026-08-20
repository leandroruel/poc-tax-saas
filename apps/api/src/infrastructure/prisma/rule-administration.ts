import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { RuleAdministration } from "../../application/ports/rule-administration.js";
import { RuleVersionLifecycle } from "../../domain/rule-governance/rule-version-lifecycle.js";
import { canonicalJson, jsonObject } from "./json.js";

function localDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hash(value: object): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function isApprovedPeriodConstraint(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2004" &&
    String(error.meta?.database_error).includes(
      "TaxRuleVersion_approved_period_excl",
    )
  );
}

type RuleTransitionAction = "submit" | "approve" | "reject" | "revoke";

function transitionLifecycle(
  lifecycle: RuleVersionLifecycle,
  action: RuleTransitionAction,
) {
  switch (action) {
    case "submit":
      return lifecycle.submitForReview();
    case "approve":
      return lifecycle.approve();
    case "reject":
      return lifecycle.reject();
    case "revoke":
      return lifecycle.revoke();
    default: {
      const unreachable: never = action;
      throw new Error(`unsupported_rule_transition:${unreachable}`);
    }
  }
}

async function lockRule(
  transaction: Prisma.TransactionClient,
  ruleId: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${ruleId}, 0))
  `;
}

export function createPrismaRuleAdministration(
  prisma: PrismaClient,
): RuleAdministration {
  return {
    async list(today) {
      const rules = await prisma.taxRule.findMany({
        include: { versions: { orderBy: { version: "desc" } } },
        orderBy: { code: "asc" },
      });
      return rules.map((rule) => ({
        id: rule.id,
        code: rule.code,
        operationType: rule.operationType,
        versions: rule.versions.map((version) => ({
          id: version.id,
          version: version.version,
          editorialStatus: version.editorialStatus,
          deploymentStatus: new RuleVersionLifecycle(
            version.editorialStatus,
          ).deploymentStatus(
            {
              effectiveFrom: localDate(version.effectiveFrom),
              effectiveTo: version.effectiveTo
                ? localDate(version.effectiveTo)
                : null,
            },
            today,
          ),
          effectiveFrom: localDate(version.effectiveFrom),
          effectiveTo: version.effectiveTo
            ? localDate(version.effectiveTo)
            : null,
          treatment: version.treatment,
          legalBasis: version.legalBasis,
          sourceUrl: version.sourceUrl,
          changeReason: version.changeReason,
          createdAt: version.createdAt.toISOString(),
        })),
      }));
    },

    async createDraft(input) {
      return prisma.$transaction(async (transaction) => {
        const rule = await transaction.taxRule.upsert({
          where: { code: input.ruleCode },
          update: {},
          create: {
            id: uuidv7(),
            code: input.ruleCode,
            operationType: input.operationType,
          },
        });
        await lockRule(transaction, rule.id);
        if (rule.operationType !== input.operationType)
          throw new Error("rule_operation_type_mismatch");
        const versionId = uuidv7();
        const latest = await transaction.taxRuleVersion.findFirst({
          where: { ruleId: rule.id },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const version = (latest?.version ?? 0) + 1;
        const snapshot = { ...input, actorUserId: undefined, version };
        await transaction.taxRuleVersion.create({
          data: {
            id: versionId,
            ruleId: rule.id,
            version,
            effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
            effectiveTo: input.effectiveTo
              ? new Date(`${input.effectiveTo}T00:00:00.000Z`)
              : null,
            treatment: jsonObject(input.treatment),
            legalBasis: input.legalBasis,
            sourceUrl: input.sourceUrl,
            changeReason: input.changeReason,
            snapshotHash: hash(snapshot),
            createdById: input.actorUserId,
          },
        });
        await transaction.auditLog.create({
          data: {
            id: uuidv7(),
            actorUserId: input.actorUserId,
            action: "rule_version.created",
            entityType: "TaxRuleVersion",
            entityId: versionId,
            after: jsonObject(snapshot),
          },
        });
        return { versionId };
      });
    },

    async transition(input) {
      try {
        await prisma.$transaction(async (transaction) => {
          const target = await transaction.taxRuleVersion.findUniqueOrThrow({
            where: { id: input.versionId },
            select: { ruleId: true },
          });
          await lockRule(transaction, target.ruleId);
          const current = await transaction.taxRuleVersion.findUniqueOrThrow({
            where: { id: input.versionId },
          });
          const lifecycle = new RuleVersionLifecycle(current.editorialStatus);
          const next = transitionLifecycle(lifecycle, input.action);

          let supersededVersionId: string | undefined;
          if (next.status === "approved") {
            const successor = await transaction.taxRuleVersion.findFirst({
              where: {
                ruleId: current.ruleId,
                editorialStatus: "approved",
                id: { not: current.id },
                effectiveFrom: {
                  gte: current.effectiveFrom,
                  lt: current.effectiveTo ?? undefined,
                },
              },
            });
            if (successor) throw new Error("rule_period_overlap");

            const predecessor = await transaction.taxRuleVersion.findFirst({
              where: {
                ruleId: current.ruleId,
                editorialStatus: "approved",
                id: { not: current.id },
                effectiveFrom: { lt: current.effectiveFrom },
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gt: current.effectiveFrom } },
                ],
              },
              orderBy: { effectiveFrom: "desc" },
            });
            if (predecessor) {
              supersededVersionId = predecessor.id;
              await transaction.taxRuleVersion.update({
                where: { id: predecessor.id },
                data: { effectiveTo: current.effectiveFrom },
              });
            }
          }

          await transaction.taxRuleVersion.update({
            where: { id: current.id },
            data: {
              editorialStatus: next.status,
              reviewedById:
                input.action === "approve" || input.action === "reject"
                  ? input.actorUserId
                  : current.reviewedById,
              approvedAt:
                input.action === "approve" ? new Date() : current.approvedAt,
            },
          });
          await transaction.auditLog.create({
            data: {
              id: uuidv7(),
              actorUserId: input.actorUserId,
              action: `rule_version.${input.action}`,
              entityType: "TaxRuleVersion",
              entityId: current.id,
              before: { editorialStatus: current.editorialStatus },
              after: { editorialStatus: next.status },
              metadata: supersededVersionId
                ? { supersededVersionId }
                : undefined,
            },
          });
        });
      } catch (error) {
        if (isApprovedPeriodConstraint(error)) {
          throw new Error("rule_period_overlap");
        }
        throw error;
      }
    },

    async audit() {
      const events = await prisma.auditLog.findMany({
        orderBy: { occurredAt: "desc" },
        take: 100,
        include: { actor: { select: { name: true, email: true } } },
      });
      return events.map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        occurredAt: event.occurredAt.toISOString(),
        actor: event.actor
          ? { name: event.actor.name, email: event.actor.email }
          : null,
        before: event.before,
        after: event.after,
        metadata: event.metadata,
      }));
    },
  };
}
