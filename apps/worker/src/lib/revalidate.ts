import { log, siteUrl } from '../context';

/**
 * Asks the Reader to drop its cached pages for a story.
 *
 * The Reader owns its own cache, so invalidation is a request rather than a
 * shared-state poke — that keeps web and worker independently deployable.
 */
export async function revalidateArticle(slug: string): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    log.warn('REVALIDATE_SECRET not set — skipping Reader cache invalidation');
    return;
  }

  const res = await fetch(`${siteUrl()}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ slug }),
  });

  if (!res.ok) {
    throw new Error(`Reader revalidation failed (${res.status})`);
  }
  log.info(`Revalidated Reader cache for ${slug}`);
}
