# Pressly worker — build from the REPOSITORY ROOT:
#   docker build -f apps/worker/Dockerfile -t pressly-worker .
# See apps/api/Dockerfile for why this is Debian rather than Alpine and why
# node_modules is copied whole.

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
# See apps/api/Dockerfile — keeps puppeteer's Chromium out of a backend image.
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/i18n/package.json packages/i18n/
COPY packages/ui/package.json packages/ui/
COPY packages/article-renderer/package.json packages/article-renderer/
COPY packages/db/package.json packages/db/
COPY packages/jobs/package.json packages/jobs/
COPY packages/search/package.json packages/search/
COPY packages/storage/package.json packages/storage/
RUN pnpm install --frozen-lockfile --filter @pressly/worker...

FROM deps AS build
COPY . .
RUN pnpm --filter @pressly/worker... build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app

# No migrations here — the API service owns the schema. Two processes racing
# `migrate deploy` on boot is how you get a half-applied migration.
CMD ["node", "apps/worker/dist/main.js"]
