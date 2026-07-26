import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import type { Prisma } from '@pressly/db';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import {
  EDITABLE_FIELDS,
  articleDetailSelect,
  readingTimeFor,
} from '@/lib/newsroom-select';
import { CONTENT_TAG, articleTag } from '@/lib/content-api';

export const runtime = 'nodejs';

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

  const data: Prisma.ArticleUpdateInput = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) (data as Record<string, unknown>)[field] = body[field];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
  }

  // publishAt arrives as an ISO string or null.
  if ('publishAt' in data) {
    data.publishAt = body.publishAt ? new Date(body.publishAt as string) : null;
  }
  if ('bodyJson' in data) {
    data.readingTime = readingTimeFor(body.bodyJson);
  }

  const existing = await prisma.article.findUnique({
    where: { id },
    select: { slug: true, status: true },
  });
  if (!existing) return NextResponse.json({ message: 'Article not found' }, { status: 404 });

  const article = await prisma.article.update({
    where: { id },
    data,
    select: articleDetailSelect,
  });

  // Editing a live story has to reach the Reader; editing a draft has nothing
  // to invalidate.
  if (existing.status === 'PUBLISHED') {
    revalidateTag(CONTENT_TAG);
    revalidateTag(articleTag(existing.slug));
  }

  return NextResponse.json(article);
}
