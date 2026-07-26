# Pressly

A calm, multilingual global news & intelligence platform.

> "Design the experience of understanding the world — not the experience of
> browsing a website."

Two connected products in one app:

- **Pressly Reader** — the public reading experience (calm, editorial, RTL-aware).
- **Pressly Newsroom** — the private publishing system (editor, media, publishing).

## Stack

| Layer    | Choice                                        |
| -------- | --------------------------------------------- |
| App      | Next.js (App Router, TS) + Tailwind + Radix   |
| Editor   | Tiptap → structured JSON (never raw HTML)     |
| Backend  | Next.js route handlers + Prisma               |
| Database | PostgreSQL (Neon in production)               |
| Search   | Postgres full-text (`tsvector` + trigger)     |
| Media    | Cloudflare R2 (S3-compatible)                 |
| Hosting  | Vercel                                        |

There was a NestJS API, a BullMQ worker, Redis and Meilisearch. Pressly has one
admin publishing their own stories, so a four-role newsroom with a nine-state
review pipeline and a job queue was ceremony around a database write. Publishing
now happens inline, search is a database trigger, and five deployed services
became one.

## Layout

```
apps/
  web/     the whole application
    src/app/[locale]/(reader)     public pages
    src/app/[locale]/(newsroom)   authenticated editor
    src/app/api/                  the entire server surface
packages/
  types/            shared TS types (article JSON, enums, locales)
  config/           design tokens + Tailwind preset
  i18n/             locale message catalogs (en, ar, fr, de)
  article-renderer/ structured JSON → React
  ui/               design-system components
  db/               Prisma schema, migrations, seed
  storage/          R2 / local-disk media storage
```

## Getting started

```bash
cp .env.example .env      # fill in secrets
pnpm install
pnpm infra:up             # postgres (docker) — the only service
pnpm db:migrate           # apply migrations
pnpm db:seed              # demo users + taxonomy + sample stories
pnpm dev
```

Sign in to the Newsroom at `/en/newsroom/login` with `editor@pressly.dev` /
`pressly123` (development seed only — production uses `db:create-admin`).

## Quality gates

Six checks run against a live server on :3000 (Postgres is the only backing
service). Each exists because something got through without it.

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

The app on **Vercel**, Postgres on **Neon**, media on **Cloudflare R2**. Full
walkthrough in [DEPLOYMENT.md](./DEPLOYMENT.md).

Three things that will bite if skipped:

- **R2 is mandatory in production.** Serverless filesystems do not persist, so
  the local-disk media fallback loses every upload on redeploy.
- **Neon needs both connection strings.** `DATABASE_URL` pooled for queries,
  `DIRECT_DATABASE_URL` unpooled for migrations.
- **Never run `pnpm db:seed` in production** — it creates demo accounts with a
  published password. Use `db:seed:taxonomy` for reference data and
  `db:create-admin` for the first real account. The seed refuses to run under
  `NODE_ENV=production`.

## v1 scope

UI is localized in **en / ar / fr / de** (Arabic is RTL). Article *content*
stays in its original language — translation lands in v2. See
`.claude/plans/…` for the full phased build plan and the v2 backlog.
