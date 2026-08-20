import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";
import { parseCnpj } from "../../domain/identity/cnpj.js";
import { prisma } from "../prisma/prisma-client.js";

const developmentSecret = "taxman-local-development-secret-change-me";

async function writeAuthAudit(input: {
  action: string;
  entityType: "User" | "Session" | "Account";
  entityId: string;
  actorUserId?: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      id: uuidv7(),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId,
      metadata: input.metadata,
    },
  });
}

function authSecret(): string {
  const configured = process.env.BETTER_AUTH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }
  return developmentSecret;
}

async function rejectExistingMembership(userId: string): Promise<void> {
  const membership = await prisma.member.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (membership) {
    throw new APIError("BAD_REQUEST", {
      message: "Cada usuário pode pertencer a somente uma empresa.",
    });
  }
}

export const auth = betterAuth({
  appName: "TaxMan",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: authSecret(),
  trustedOrigins: [process.env.APP_ORIGIN ?? "http://localhost:3001"],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    user: {
      create: {
        after: (user) =>
          writeAuthAudit({
            action: "identity.user_created",
            entityType: "User",
            entityId: user.id,
            actorUserId: user.id,
          }),
      },
      update: {
        after: (user) =>
          writeAuthAudit({
            action: "identity.user_updated",
            entityType: "User",
            entityId: user.id,
            actorUserId: user.id,
          }),
      },
    },
    session: {
      create: {
        after: (session) =>
          writeAuthAudit({
            action: "identity.session_created",
            entityType: "Session",
            entityId: session.id,
            actorUserId: session.userId,
          }),
      },
      delete: {
        after: (session) =>
          writeAuthAudit({
            action: "identity.session_revoked",
            entityType: "Session",
            entityId: session.id,
            actorUserId: session.userId,
          }),
      },
    },
    account: {
      create: {
        after: (account) =>
          writeAuthAudit({
            action: "identity.account_linked",
            entityType: "Account",
            entityId: account.id,
            actorUserId: account.userId,
            metadata: { providerId: account.providerId },
          }),
      },
      update: {
        after: (account) =>
          writeAuthAudit({
            action: "identity.account_updated",
            entityType: "Account",
            entityId: account.id,
            actorUserId: account.userId,
            metadata: { providerId: account.providerId },
          }),
      },
      delete: {
        after: (account) =>
          writeAuthAudit({
            action: "identity.account_unlinked",
            entityType: "Account",
            entityId: account.id,
            actorUserId: account.userId,
            metadata: { providerId: account.providerId },
          }),
      },
    },
  },
  emailAndPassword: { enabled: true },
  verification: { storeIdentifier: "hashed" },
  user: {
    additionalFields: {
      platformRole: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "user",
      },
    },
  },
  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
  },
  plugins: [
    organization({
      organizationLimit: 1,
      schema: {
        organization: {
          additionalFields: {
            taxId: {
              type: "string",
              required: true,
              input: true,
              unique: true,
            },
            segment: { type: "string", required: true, input: true },
          },
        },
      },
      organizationHooks: {
        beforeCreateOrganization: async ({ organization: candidate, user }) => {
          await rejectExistingMembership(user.id);
          const segment = candidate.segment;
          if (
            segment !== "credit_provider" &&
            segment !== "insurance_pension"
          ) {
            throw new APIError("BAD_REQUEST", {
              message: "Segmento empresarial inválido.",
            });
          }
          try {
            return {
              data: {
                ...candidate,
                taxId: parseCnpj(String(candidate.taxId ?? "")),
                segment,
              },
            };
          } catch {
            throw new APIError("BAD_REQUEST", { message: "CNPJ inválido." });
          }
        },
        beforeAddMember: async ({ member }) =>
          rejectExistingMembership(member.userId),
        beforeAcceptInvitation: async ({ user }) =>
          rejectExistingMembership(user.id),
      },
    }),
  ],
});
