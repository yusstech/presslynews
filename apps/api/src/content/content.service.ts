import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pressly/db';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_STATUSES: Prisma.ArticleWhereInput['status'] = {
  in: ['PUBLISHED', 'UPDATED', 'CORRECTED'],
};

const cardInclude = {
  author: { select: { id: true, name: true, slug: true, role: true } },
  country: true,
  topic: true,
  heroImage: true,
} satisfies Prisma.ArticleInclude;

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  private publishedWhere(extra: Prisma.ArticleWhereInput = {}): Prisma.ArticleWhereInput {
    return { status: PUBLIC_STATUSES, publishedAt: { lte: new Date() }, ...extra };
  }

  listPublished(limit = 30) {
    return this.prisma.article.findMany({
      where: this.publishedWhere(),
      include: cardInclude,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  async getBySlug(slug: string) {
    const article = await this.prisma.article.findFirst({
      where: this.publishedWhere({ slug }),
      include: cardInclude,
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  byCountry(code: string) {
    return this.prisma.article.findMany({
      where: this.publishedWhere({ country: { code } }),
      include: cardInclude,
      orderBy: { publishedAt: 'desc' },
    });
  }

  byTopic(slug: string) {
    return this.prisma.article.findMany({
      where: this.publishedWhere({ topic: { slug } }),
      include: cardInclude,
      orderBy: { publishedAt: 'desc' },
    });
  }

  async home() {
    const all = await this.listPublished(30);
    const [hero, ...rest] = all;
    return {
      hero: hero ?? null,
      breaking: all.filter((a) => a.isBreaking),
      latest: rest.slice(0, 6),
      editorsPicks: all.filter((a) => a.articleType === 'FEATURE').slice(0, 4),
    };
  }
}
