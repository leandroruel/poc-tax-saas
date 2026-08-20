FROM node:22-bookworm-slim

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY --chown=node:node apps/web apps/web
ENV API_INTERNAL_URL=http://api:3000
RUN pnpm --filter web build

EXPOSE 3001
USER node
CMD ["pnpm", "--filter", "web", "start"]
