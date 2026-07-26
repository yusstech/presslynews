# Pressly API — build from the REPOSITORY ROOT, not this directory:
#   docker build -f apps/api/Dockerfile -t pressly-api .
# On Railway set the service's Dockerfile path to apps/api/Dockerfile and leave
# the build context at the repo root; a pnpm workspace cannot install from
# inside one package.

# Debian, not Alpine. Both Prisma's query engine and sharp's prebuilt binaries
# want glibc; on musl they either fall back to a slow build-from-source or fail
# outright.
FROM node:20-slim AS base
# Two statements on purpose: within a single ENV, PNPM_HOME is not yet defined
# when PATH is expanded, so PATH would silently lose it.
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl is required by Prisma's engine at runtime and is not in -slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
# apps/web carries puppeteer for the quality-gate scripts. Nothing server-side
# needs it, and letting it fetch a Chromium adds ~300MB and a download that can
# fail the build outright.
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────────
# Manifests first so this layer is cached until a dependency actually changes.
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
# Every manifest is copied above so --frozen-lockfile can validate the whole
# workspace, but --filter installs only the API's subgraph: no Next, no Tiptap,
# no Chromium in a backend image.
RUN pnpm install --frozen-lockfile --filter @pressly/api...

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
# `@pressly/api...` means "the API and everything it depends on": types, db
# (which runs `prisma generate`), jobs, search, storage. The web-only packages
# (config, i18n, ui, article-renderer) ship raw TS and are not in this graph.
RUN pnpm --filter @pressly/api... build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
# node_modules is copied whole rather than pruned: the generated Prisma client
# lives there, as does the prisma CLI used by the migrate-on-boot start command.
# A correct image beats a smaller broken one — trim it later if it matters.
COPY --from=build /app /app

# Railway injects PORT; the app reads API_PORT, so map it at boot.
ENV API_PORT=4000
EXPOSE 4000

# Migrations run here rather than in a separate release step because Railway
# has no release phase. Safe at one replica; revisit before scaling out.
CMD ["sh", "-c", "pnpm --filter @pressly/db exec prisma migrate deploy && node apps/api/dist/main.js"]
