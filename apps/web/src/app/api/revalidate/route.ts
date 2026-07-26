import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { CONTENT_TAG, articleTag } from '@/lib/content-api';

/**
 * Cache invalidation hook called by the BullMQ worker during publish fan-out.
 *
 * Guarded by a shared secret rather than a user session: the caller is a
 * machine, and an unauthenticated endpoint here would let anyone stampede the
 * origin by dumping the cache in a loop.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Revalidation is not configured' }, { status: 501 });
  }
  if (request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { slug?: string };

  // Listing pages (home, country, topic, feed, sitemap) all share the content
  // tag; the story itself gets its own so a single publish is cheap to clear.
  revalidateTag(CONTENT_TAG);
  if (body.slug) revalidateTag(articleTag(body.slug));

  return NextResponse.json({ revalidated: true, slug: body.slug ?? null });
}
