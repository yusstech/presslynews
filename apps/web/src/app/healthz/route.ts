export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe.
 *
 * Deliberately does nothing: no database, no locale handling, no redirect. The
 * health check previously pointed at `/en`, which meant a slow or sleeping
 * Postgres could mark a perfectly healthy container as failed — and once the
 * canonical-host redirect existed, a probe arriving on the `.onrender.com`
 * hostname would have been answered with a 308 and failed the deploy outright.
 *
 * `middleware.ts` excludes this path for the same reason.
 */
export function GET() {
  return new Response('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
