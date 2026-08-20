FROM node:22-bookworm-slim

RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY --chown=node:node apps/api apps/api
RUN pnpm --filter api prisma:generate && pnpm --filter api build

EXPOSE 3000
USER node
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && pnpm --filter api seed && pnpm --filter api start"]
