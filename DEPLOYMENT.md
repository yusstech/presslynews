# Deploying Pressly

Web on **Vercel**, everything else on **Railway**, media on **Cloudflare R2**.

Why split: `apps/web/src/i18n/geo.ts` reads `x-vercel-ip-country` before
`cf-ipcountry`, so the locale first-guess works natively on Vercel. On bare
Railway neither header exists and every visitor silently gets the default
locale. Vercel's image optimisation is irrelevant either way — the Reader
serves its own `<picture>` variants and never uses `next/image`.

```
Vercel                    Railway (one project, private network)
──────────                ─────────────────────────────────────
apps/web  ──── https ───▶  api ──┬── Postgres
                           worker ┼── Redis
                                  └── Meilisearch (volume)
                                        │
                          media ────────┴──▶ Cloudflare R2
```

---

## 1. Cloudflare R2 (do this first — the API needs the keys)

**R2 is not optional.** Railway container filesystems are ephemeral: with the
local-disk fallback, every uploaded image disappears on the next redeploy.

1. Cloudflare dashboard → **R2** → **Create bucket** → name it `pressly-media`.
2. **R2 → Manage API Tokens → Create API token**, permission **Object Read &
   Write**, scoped to that bucket. Copy the **Access Key ID** and **Secret
   Access Key** now — the secret is shown once.
3. **Account ID** is on the R2 overview page.
4. Bucket → **Settings → Public access**:
   - quickest: enable the **r2.dev** subdomain;
   - better for production: **Connect a custom domain**, e.g.
     `media.yourdomain.com`. r2.dev is rate-limited and not meant for
     production traffic.
5. The resulting public base URL is `R2_PUBLIC_URL` (no trailing slash).

`packages/storage/src/index.ts` switches from local disk to R2 automatically
once `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are all
set. No code change, no flag.

## 2. Railway

Create **one project** with five services so they share the private network.

### Postgres and Redis
Add both from Railway's catalogue. They provide `DATABASE_URL` and `REDIS_URL`
— reference them in the other services rather than pasting values.

### Meilisearch
Deploy the image `getmeili/meilisearch:v1.10`.

- **Attach a volume mounted at `/meili_data`.** Without it the whole index is
  lost on redeploy. The Reader degrades to no search results.
- Variables: `MEILI_MASTER_KEY` (generate a long random string),
  `MEILI_ENV=production`.

### api
Source: this repo. **Dockerfile path `apps/api/Dockerfile`**, build context the
repo root (a pnpm workspace cannot install from inside one package).

Migrations run automatically on boot via the container's start command.

### worker
Source: this repo. **Dockerfile path `apps/worker/Dockerfile`**. No migrations —
the API owns the schema; two processes racing `migrate deploy` is how you get a
half-applied migration.

### Variables

Shared by **api** and **worker**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | reference the Postgres service |
| `REDIS_URL` | reference the Redis service |
| `MEILISEARCH_HOST` | the Meilisearch service's private URL |
| `MEILISEARCH_KEY` | the `MEILI_MASTER_KEY` you generated |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET` `R2_PUBLIC_URL` | from step 1 |
| `RESEND_API_KEY` `EMAIL_FROM` | omit the key and mail is logged, not sent |
| `REVALIDATE_SECRET` | generate; **must match Vercel's** |
| `NODE_ENV` | `production` |

**api** additionally:

| Variable | Value |
|---|---|
| `JWT_SECRET` | generate — never the `.env.example` placeholder |
| `JWT_EXPIRES_IN` | `7d` |
| `API_PUBLIC_URL` | the api service's public URL |
| `CORS_ORIGINS` | the Vercel production URL (step 3) |
| `CORS_PREVIEW_SUFFIX` | `.vercel.app` to allow preview deploys |
| `API_PORT` | `4000` |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## 3. Vercel

Import the repo. **Root Directory: `apps/web`** — Vercel detects the pnpm
workspace and installs from the repo root.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | the Railway **api** public URL (no trailing slash) |
| `NEXT_PUBLIC_SITE_URL` | the Vercel production URL |
| `REVALIDATE_SECRET` | same value as Railway |

**Ordering:** the API needs `CORS_ORIGINS` set to the Vercel URL, and Vercel
needs `NEXT_PUBLIC_API_URL` set to the Railway URL. Deploy one, copy its URL to
the other, redeploy.

## 4. First run

Run these as Railway one-off commands on the **api** service.

```bash
# 1. Reference data — countries, topics, languages. Safe in production.
pnpm --filter @pressly/db seed:taxonomy:prod

# 2. The first account. There are no users until you do this.
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='a long unique password' \
ADMIN_NAME='Your Name' \
  pnpm --filter @pressly/db create-admin:prod
```

> **Never run `pnpm db:seed` in production.** That is the development seed: it
> creates four demo accounts with the password `pressly123`. It refuses to run
> when `NODE_ENV=production`, and that guard is there on purpose.

Then sign in at `/newsroom/login`, publish a story, and populate the search
index:

```bash
curl -X POST https://<api-url>/api/search/reindex \
  -H "Authorization: Bearer <token>"
```

## 5. Verify

- `/en` renders; `/ar` renders right-to-left.
- Sign in to `/newsroom` **from the Vercel domain** — this is what proves CORS.
- Upload a hero image. Confirm it is served from your R2 public URL, **then
  redeploy the API and confirm it is still there.** That is the check that
  proves the ephemeral-disk trap is closed.
- Publish a story → it appears in ⌘K search (worker + Meilisearch) and the
  Reader page updates (revalidate webhook).

Re-run the quality gates against production:

```bash
BASE_URL=https://your-domain pnpm --filter @pressly/web a11y
BASE_URL=https://your-domain pnpm --filter @pressly/web responsive
BASE_URL=https://your-domain pnpm --filter @pressly/web perf
```

## Building the images locally

Always from the repo root:

```bash
docker build -f apps/api/Dockerfile -t pressly-api .
docker build -f apps/worker/Dockerfile -t pressly-worker .
```

## Known constraints

- **Single API replica.** Migrations run on boot; scaling out means moving them
  to a dedicated release step first.
- **SSR fetches cross the public internet** (Vercel → Railway). Reader pages are
  tag-cached and revalidated on publish, so the API is hit on revalidation
  rather than per reader — but `/search` is `force-dynamic` and does hit it on
  every request.
- **Images are large** (~1GB): `node_modules` is copied whole because the
  generated Prisma client lives there. Correct beats small; optimise later.
