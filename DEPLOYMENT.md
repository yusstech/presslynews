# Deploying Pressly

Two services: **Vercel** (the whole app) and **Neon** (Postgres), plus
**Cloudflare R2** for media.

There is no separate API, no worker, no Redis and no search service. Publishing
runs inline in a route handler, search is a Postgres `tsvector`, and scheduled
releases are a Vercel cron. If you are looking for the Railway and Docker
instructions, they were deleted along with the backend they described.

```
Vercel                          Neon
──────────────────────          ────────────
apps/web                 ───▶   postgres
  (reader + newsroom
   + /api routes)               Cloudflare R2
                         ───▶   media
```

---

## 1. Cloudflare R2 (first — the app needs the keys)

**R2 is not optional in production.** Serverless filesystems do not persist, so
the local-disk media fallback would lose every uploaded image.

1. Cloudflare dashboard → **R2** → **Create bucket** → `pressly-media`.
2. **R2 → Manage API Tokens → Create API token**, permission **Object Read &
   Write**, scoped to that bucket. Copy the **Access Key ID** and **Secret
   Access Key** now — the secret is shown once.
3. **Account ID** is on the R2 overview page.
4. Bucket → **Settings → Public access**: enable the **r2.dev** subdomain to
   start, or connect a custom domain such as `media.yourdomain.com` for
   production (r2.dev is rate-limited and not meant for real traffic).
5. That public base URL is `R2_PUBLIC_URL`, without a trailing slash.

`packages/storage` switches from local disk to R2 automatically once
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are set.

## 2. Neon

Create a project. Neon gives you two connection strings and **you need both**:

| Variable | Which string |
|---|---|
| `DATABASE_URL` | the **pooled** one (host contains `-pooler`) |
| `DIRECT_DATABASE_URL` | the **direct** one |

Serverless functions open far more concurrent clients than a direct Postgres
connection limit allows, so queries go through the pooler. Migrations cannot run
over a pooled connection, which is why Prisma needs the direct one as well.

## 3. Vercel

Import the repo. **Root Directory: `apps/web`** — Vercel detects the pnpm
workspace and installs from the repo root.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled |
| `DIRECT_DATABASE_URL` | Neon direct |
| `SESSION_SECRET` | generate — signs the newsroom session cookie |
| `NEXT_PUBLIC_SITE_URL` | your production URL |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET` `R2_PUBLIC_URL` | from step 1 |
| `CRON_SECRET` | Vercel sets this; the cron route rejects requests without it |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Scheduled publishing

Add `apps/web/vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/publish-due", "schedule": "*/5 * * * *" }] }
```

**On the Hobby plan crons run once a day**, so a scheduled story appears within
a day rather than at its exact minute. "Publish now" is unaffected. Every-five-
minutes needs Pro.

## 4. First run

Migrations do **not** run automatically — there is no long-lived process to run
them on boot. Run them from your machine against the production database:

```bash
DATABASE_URL="<neon direct url>" pnpm db:migrate:prod
DATABASE_URL="<neon direct url>" pnpm --filter @pressly/db seed:taxonomy:prod

DATABASE_URL="<neon direct url>" \
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='a long unique password' \
ADMIN_NAME='Your Name' \
  pnpm --filter @pressly/db create-admin:prod
```

> **Never run `pnpm db:seed` against production.** That is the development seed
> and it creates demo accounts with a published password. It refuses to run when
> `NODE_ENV=production`; the guard is deliberate.

Then sign in at `/newsroom/login` and publish something.

## 5. Verify

- `/en` renders; `/ar` renders right-to-left.
- Sign in at `/newsroom/login`, create a story, publish it, and confirm it
  appears on the Reader — that one flow exercises the session cookie, Prisma
  writes and `revalidateTag` together.
- Search for a word from the body in ⌘K. If it appears, the Postgres trigger is
  maintaining the search vector.
- Upload a hero image, confirm it is served from your R2 public URL, **then
  redeploy and confirm it is still there.** That is the check that proves media
  is not sitting on an ephemeral disk.

Run the quality gates against production:

```bash
BASE_URL=https://your-domain pnpm --filter @pressly/web a11y
BASE_URL=https://your-domain pnpm --filter @pressly/web responsive
BASE_URL=https://your-domain pnpm --filter @pressly/web perf
```

## Known limits

- **Uploads cap at 4.5MB** — Vercel's request body limit. The upload route
  rejects anything over 4MB with a clear message rather than failing opaquely.
  If it becomes a problem, the fix is a presigned direct-to-R2 upload so the
  bytes never pass through a function.
- **Scheduled publishing is daily on Hobby** (see above).
- **Migrations are run by hand.** With one admin and infrequent schema changes
  that is safer than running them automatically on every deploy.
