import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CONTENT_TAG, articleTag } from '@/lib/content-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cache invalidation for writers outside the app.
 *
 * Publishing through the Newsroom calls `revalidateTag` in-process and needs
 * nothing here. The command-line publisher (`pnpm db:publish`) writes straight
 * to Postgres from another process, so it has no way to reach Next's cache —
 * without this, a story published from a script is live on its own URL but
 * missing from the homepage until the 5-minute window lapses.
 *
 * Protected by REVALIDATE_SECRET. Unauthenticated, this would let anyone
 * repeatedly dump the cache and force the database to serve every request.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: 'REVALIDATE_SECRET is not configured' },
      { status: 501 },
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { slugs?: string[] };

  revalidateTag(CONTENT_TAG);
  for (const slug of body.slugs ?? []) revalidateTag(articleTag(slug));

  return NextResponse.json({ revalidated: true, slugs: body.slugs ?? [] });
}
