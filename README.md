# Pressly

A calm, multilingual global news & intelligence platform.

> "Design the experience of understanding the world — not the experience of
> browsing a website."

Two connected products in one monorepo:

- **Pressly Reader** — the public reading experience (calm, editorial, RTL-aware).
- **Pressly Newsroom** — the private publishing system (editor, workflow, media).

## Stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Frontend   | Next.js (App Router, TS) + Tailwind + Radix        |
| Editor     | Tiptap → structured JSON (never raw HTML)          |
| Backend    | NestJS modular monolith                            |
| Jobs       | BullMQ (Redis) worker                              |
| Database   | PostgreSQL (Prisma)                                |
| Search     | Meilisearch                                        |
| Media      | Cloudflare R2 (S3-compatible)                      |
| Email      | Resend (transactional)                             |
| Infra      | Railway (Dockerized, portable)                     |

## Layout

```
apps/
  web/     Next.js — Reader + Newsroom UI
  api/     NestJS API
  worker/  BullMQ background jobs
packages/
  types/            shared TS types (article JSON, enums, locales)
  config/           design tokens + Tailwind preset
  i18n/             locale message catalogs (en, ar, fr, de)
  article-renderer/ structured JSON → React (shared)
  ui/               design-system components
  db/               Prisma schema, migrations, seed + generated client
  jobs/             BullMQ queue names & job payload contracts
  search/           Meilisearch index (API reads, worker writes)
  storage/          R2 / local-disk media storage
```

The bottom four packages exist because the API and the worker are separate
processes that must agree: one schema, one queue contract, one index mapping,
one storage layout.

## Getting started

```bash
cp .env.example .env      # fill in secrets
pnpm install
pnpm infra:up             # postgres + redis + meilisearch (docker)
pnpm db:migrate           # apply migrations
pnpm db:seed              # demo users + taxonomy
pnpm dev                  # run everything via turbo
```

## Background jobs

The worker (`apps/worker`) owns everything a publish must not wait on:

| Job                  | Does                                                        |
| -------------------- | ----------------------------------------------------------- |
| `article.published`  | search index, social card, cache invalidation, author email  |
| `article.unpublished`| drops the story from the index and Reader caches             |
| `article.publish-due`| sweeps every 60s and releases `SCHEDULED` stories            |
| `email.send`         | Resend delivery (logs to console when no API key is set)     |
| `media.optimize`     | derives the AVIF variant off the upload path                 |

Both degraded modes are deliberate and exercised: with no `RESEND_API_KEY` mail
is rendered and logged instead of sent, and with Redis unreachable the API falls
back to indexing inline so a publish still succeeds (notifications are skipped).

## Quality gates

Six checks run against a live server (`pnpm dev` or `pnpm start` on :3000, with
the API up). Each exists because something got through without it.

```bash
pnpm --filter @pressly/web a11y            # axe across 12 surfaces incl. ⌘K palette
pnpm --filter @pressly/web a11y:keyboard   # skip link, focus ring, dialog focus trap
pnpm --filter @pressly/web hover           # interactions are VISIBLE (pixel diff)
pnpm --filter @pressly/web design-system   # no hand-rolled buttons or inputs
pnpm --filter @pressly/web responsive      # overflow, touch targets, text size
pnpm --filter @pressly/web perf            # page weight, LCP, CLS
```

`a11y:keyboard` exists because axe cannot see behaviour: it proves the skip link
is the first tab stop, that focus is trapped in the ⌘K dialog and restored on
close, and that Escape works from anywhere inside it.

`hover` exists because a hover state once shipped that fired correctly and was
invisible — a headline shifting from `#111111` to `#16213E`, a contrast ratio of
1.19:1. Computed style proves code ran; only pixels prove a reader can see it.

`design-system` exists because `packages/ui` was once a library the app never
imported: 20 raw `<button>` elements across 18 class strings, so editing the
shared component changed nothing on screen.

## Deploying

Web on Vercel, API + worker + Postgres + Redis + Meilisearch on Railway, media
on Cloudflare R2. Full walkthrough in [DEPLOYMENT.md](./DEPLOYMENT.md).

```bash
docker build -f apps/api/Dockerfile    -t pressly-api    .   # from the repo root
docker build -f apps/worker/Dockerfile -t pressly-worker .
```

Two things that will bite if skipped:

- **R2 is mandatory in production.** Railway filesystems are ephemeral, so the
  local-disk media fallback loses every upload on redeploy.
- **Never run `pnpm db:seed` in production** — it creates demo accounts with a
  published password. Use `db:seed:taxonomy` for reference data and
  `db:create-admin` for the first real account. The seed refuses to run under
  `NODE_ENV=production`.

## v1 scope

UI is localized in **en / ar / fr / de** (Arabic is RTL). Article *content*
stays in its original language — translation lands in v2. See
`.claude/plans/…` for the full phased build plan and the v2 backlog.
