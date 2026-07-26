import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { articleSummarySelect, slugify } from '@/lib/newsroom-select';

export const runtime = 'nodejs';

/** Every story, newest activity first. One admin — no per-author filtering. */
export async function GET() {
  try {
    await requireUser();
  } catch (res) {
    return res as Response;
  }

  const articles = await prisma.article.findMany({
    select: articleSummarySelect,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(articles);
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const body = (await request.json().catch(() => ({}))) as { workingTitle?: string };
  const workingTitle = body.workingTitle?.trim() || 'Untitled story';

  const article = await prisma.article.create({
    data: {
      workingTitle,
      headline: workingTitle,
      slug: slugify(workingTitle),
      authorId: user.id,
    },
    select: articleSummarySelect,
  });

  return NextResponse.json(article, { status: 201 });
}
