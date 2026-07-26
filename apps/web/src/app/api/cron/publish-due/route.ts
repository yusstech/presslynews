import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { CONTENT_TAG, articleTag } from '@/lib/content-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Releases scheduled stories.
 *
 * The worker swept for these every 60 seconds; a scheduler now calls this on an
 * interval instead. "Publish now" does not depend on it.
 *
 * Fails closed. This previously skipped the check entirely when CRON_SECRET was
 * unset — which is exactly the state a fresh deployment is in, so the endpoint
 * that publishes stories would have been open to anyone until someone
 * remembered to set the variable. A missing secret is a misconfiguration, not
 * permission.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const due = await prisma.article.findMany({
    where: { status: 'SCHEDULED', publishAt: { lte: new Date() } },
    select: { id: true, slug: true, publishedAt: true, publishAt: true },
  });

  for (const article of due) {
    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: article.publishedAt ?? article.publishAt ?? new Date(),
        },
      }),
      prisma.articleStatusEvent.create({
        data: { articleId: article.id, fromStatus: 'SCHEDULED', toStatus: 'PUBLISHED' },
      }),
    ]);
    revalidateTag(articleTag(article.slug));
  }

  if (due.length > 0) revalidateTag(CONTENT_TAG);

  return NextResponse.json({ released: due.length });
}
