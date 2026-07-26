import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { CONTENT_TAG, articleTag } from '@/lib/content-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Releases scheduled stories.
 *
 * The worker swept for these every 60 seconds. Vercel Cron calls this instead
 * — on the Hobby plan that is once a day, so scheduling is approximate unless
 * the project is on Pro. "Publish now" is unaffected either way.
 *
 * Vercel signs cron requests with CRON_SECRET; without that check the route
 * would be a public endpoint that publishes drafts.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
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
