# Deploying Pressly

Three services: **Render** (the app), **Neon** (Postgres) and **Cloudinary**
(media).

There is no separate API, no worker, no Redis and no search service. Publishing
runs inline in a route handler, search is a Postgres `tsvector`, and scheduled
releases are a cron job that calls one endpoint.

```
Render                          Neon
──────────────────────          ────────────
apps/web                 ───▶   postgres
  (reader + newsroom
   + /api routes)               Cloudinary
                         ───▶   media
```

> Render runs a long-lived Node process, not serverless functions. Two things
> that used to be true on Vercel are not true here: there is no request body
> size limit, and the filesystem is writable — but it is **ephemeral**, wiped on
> every deploy. That is why Cloudinary is not optional.

---

## 1. Cloudinary

From the dashboard, copy the **API environment variable** — the whole
`cloudinary://<api_key>:<api_secret>@<cloud_name>` string. That single value is
`CLOUDINARY_URL` and it is all the app needs.

Uploads go to the `pressly/media/` folder, one object each. The four responsive
widths are URL transformations (`c_limit,q_auto,w_320` and friends), not stored
derivatives, so nothing is generated at upload time and changing the widths
later is a code change with no re-processing.

## 2. Neon

Create a project. Neon gives you two connection strings and **you need both**:

| Variable | Which string |
|---|---|
| `DATABASE_URL` | the **pooled** one (host contains `-pooler`) |
| `DIRECT_DATABASE_URL` | the **direct** one |

Queries go through the pooler; Prisma migrations cannot run over a pooled
connection, which is why the direct string is needed as well.

## 3. Render

Easiest path is the blueprint at `render.yaml` in the repo root: **Blueprints →
New Blueprint Instance**, point it at this repository, and fill in the variables
it asks for. That creates the web service and the cron job together.

To set it up by hand instead — **New → Web Service**, connect the repo, then:

| Setting | Value |
|---|---|
| Root Directory | *(blank — the repo root)* |
| Runtime | Node |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && pnpm build` |
| Start Command | `pnpm --filter @pressly/web start` |
| Health Check Path | `/en` |

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled |
| `DIRECT_DATABASE_URL` | Neon direct |
| `SESSION_SECRET` | generate — signs the newsroom session cookie |
| `CRON_SECRET` | generate — authorises the scheduled-publish endpoint |
| `CLOUDINARY_URL` | from step 1 |
| `NEXT_PUBLIC_SITE_URL` | your production URL |
| `NODE_VERSION` | `20` |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> **`DATABASE_URL` must be set before the first build, not just at runtime.**
> `next build` prerenders the home page and the topic and country listings,
> which read the database. Without it the build fails with a Prisma connection
> error that looks nothing like a missing environment variable.

### Scheduled publishing

`render.yaml` includes an hourly cron service that calls
`/api/cron/publish-due` with the shared `CRON_SECRET`. Render bills cron jobs
separately; if that is unwanted, delete the block and either call the same URL
from an external scheduler or publish with past dates only, which needs no cron
at all.

The route **fails closed**: with `CRON_SECRET` unset it returns 503 rather than
running unauthenticated.

## 4. First run

Migrations do **not** run on deploy. There is no boot hook, and with one admin
and infrequent schema changes, running them deliberately is safer. Run them from
your machine against the production database:

`schema.prisma` declares `directUrl`, so **both** variables must be set even
though migrations only use the direct one. With `DIRECT_DATABASE_URL` missing
Prisma stops at `P1012: Environment variable not found` before it connects to
anything.

```bash
export DATABASE_URL="<neon DIRECT url>"
export DIRECT_DATABASE_URL="<neon DIRECT url>"

pnpm db:migrate:prod
pnpm --filter @pressly/db seed:taxonomy:prod

ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD='a long unique password' \
ADMIN_NAME='Your Name' \
  pnpm --filter @pressly/db create-admin:prod
```

Use the **direct** URL for both here — this is a one-off from a laptop, not the
connection-pooled traffic the running app makes. `ADMIN_PASSWORD` must be at
least 12 characters.

> **Never run `pnpm db:seed` against production.** That is the development seed
> and it creates demo accounts with a published password. It refuses to run when
> `NODE_ENV=production`; the guard is deliberate.

There is no password reset — the forgot-password screen posts to an endpoint
that does not exist. `create-admin` is the recovery path until that is either
built or removed.

## 5. Verify

- `/en` renders; `/ar` renders right-to-left.
- Sign in at `/newsroom/login`, create a story, publish it, and confirm it
  appears on the Reader — that one flow exercises the session cookie, Prisma
  writes and `revalidateTag` together.
- Search for a word from the body in ⌘K. If it appears, the Postgres trigger is
  maintaining the search vector.
- Upload a hero image and confirm the URL it renders is on `res.cloudinary.com`.
  If it starts with `/media/`, `CLOUDINARY_URL` is not set and the image will
  disappear at the next deploy.

Run the quality gates against production:

```bash
BASE_URL=https://your-domain pnpm --filter @pressly/web a11y
BASE_URL=https://your-domain pnpm --filter @pressly/web responsive
BASE_URL=https://your-domain pnpm --filter @pressly/web perf
```

## Known limits

- **Uploads cap at 20MB**, enforced by the route rather than the platform.
- **Migrations are run by hand** (see above).
- **Scheduled publishing is as granular as the cron schedule** — hourly by
  default in `render.yaml`.
- **Free Render instances sleep after inactivity**, so the first request after a
  quiet period takes a few seconds. The blueprint asks for `starter` to avoid
  that.
