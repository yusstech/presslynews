import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { articleDetailSelect, buildArticleUpdate } from '@/lib/newsroom-select';
import { CONTENT_TAG, articleTag } from '@/lib/content-api';

export const runtime = 'nodejs';

/** Prisma's foreign-key constraint failure. Matched without importing the
 *  runtime error class, which drags the client into the bundle. */
function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2003';
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;
  const article = await prisma.article.findUnique({ where: { id }, select: articleDetailSelect });
  if (!article) return NextResponse.json({ message: 'Article not found' }, { status: 404 });
  return NextResponse.json(article);
}

/**
 * Autosave. The editor PATCHes a partial article as the writer types, so this
 * takes whatever subset of the editable fields arrives.
 *
 * Status is NOT editable here — publishing has consequences (timestamps, cache
 * invalidation) and belongs on its own route rather than being reachable by
 * putting a string in an autosave body.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const built = buildArticleUpdate(body);
  if ('error' in built) {
    return NextResponse.json({ message: built.error }, { status: 400 });
  }
  const { data } = built;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
  }

  const existing = await prisma.article.findUnique({
    where: { id },
    select: { slug: true, status: true },
  });
  if (!existing) return NextResponse.json({ message: 'Article not found' }, { status: 404 });

  let article;
  try {
    article = await prisma.article.update({
      where: { id },
      data,
      select: articleDetailSelect,
    });
  } catch (err) {
    // A topicId, countryId or heroImageId that names a row which does not
    // exist. Values are validated in shape before this point, so reaching here
    // means a real reference problem — the writer's mistake, or a row deleted
    // between the editor loading and this save. Either way it is a 400, not the
    // 500 an unhandled Prisma error would produce.
    if (isForeignKeyViolation(err)) {
      return NextResponse.json(
        { message: 'That country, topic or image no longer exists' },
        { status: 400 },
      );
    }
    throw err;
  }

  // Editing a live story has to reach the Reader; editing a draft has nothing
  // to invalidate.
  if (existing.status === 'PUBLISHED') {
    revalidateTag(CONTENT_TAG);
    revalidateTag(articleTag(existing.slug));
  }

  return NextResponse.json(article);
}
