import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { canTransition, type ArticleStatus } from '@pressly/types';
import type { Prisma } from '@pressly/db';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { articleDetailSelect } from '@/lib/newsroom-select';
import { CONTENT_TAG, articleTag } from '@/lib/content-api';

export const runtime = 'nodejs';

/**
 * Status changes.
 *
 * This replaces a worker that fanned publishing out across three BullMQ queues
 * — search indexing, cache invalidation, author email. Indexing is now a
 * database trigger, the email had one recipient who is also the sender, and
 * invalidation is a function call. What is left fits in one handler.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    toStatus?: ArticleStatus;
    comment?: string;
  };
  const to = body.toStatus;
  if (!to) return NextResponse.json({ message: 'toStatus is required' }, { status: 400 });

  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, slug: true, status: true, publishedAt: true, publishAt: true },
  });
  if (!article) return NextResponse.json({ message: 'Article not found' }, { status: 404 });

  if (!canTransition(article.status, to)) {
    return NextResponse.json(
      { message: `Cannot move a ${article.status} story to ${to}` },
      { status: 400 },
    );
  }
  if (to === 'SCHEDULED' && !article.publishAt) {
    return NextResponse.json(
      { message: 'Set a publish date before scheduling' },
      { status: 400 },
    );
  }

  const data: Prisma.ArticleUpdateInput = { status: to };
  // Stamp publishedAt the first time a story goes live and never again — it is
  // the story's date of record, not the date of the last edit.
  //
  // `publishAt` wins when it is set, which is what /api/cron/publish-due
  // already does. This route used to ignore it and always stamp `now`, so the
  // two publish paths disagreed: releasing a story on its schedule kept the
  // intended date, while pressing Publish on the same story overwrote it with
  // today. That is not cosmetic — `publishedAt` is the article's date on the
  // page, its `lastmod` in the sitemap and its `datePublished` in JSON-LD, and
  // every project record here carries a real historic date.
  if (to === 'PUBLISHED' && !article.publishedAt) {
    data.publishedAt = article.publishAt ?? new Date();
  }

  const [updated] = await prisma.$transaction([
    prisma.article.update({ where: { id }, data, select: articleDetailSelect }),
    prisma.articleStatusEvent.create({
      data: {
        articleId: id,
        fromStatus: article.status,
        toStatus: to,
        actorId: user.id,
        comment: body.comment ?? null,
      },
    }),
  ]);

  // Anything entering or leaving the public set changes the Reader.
  if (to === 'PUBLISHED' || article.status === 'PUBLISHED') {
    revalidateTag(CONTENT_TAG);
    revalidateTag(articleTag(article.slug));
  }

  return NextResponse.json(updated);
}
