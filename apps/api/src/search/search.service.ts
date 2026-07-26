import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ArticleSearchIndex, type SearchFilters } from '@pressly/search';
import { isPublic, type ArticleStatus } from '@pressly/types';
import { PrismaService } from '../prisma/prisma.service';

const searchInclude = { author: true, country: true, topic: true } as const;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly index = new ArticleSearchIndex();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.index.ensureIndex();
      await this.reindexAll();
    } catch (err) {
      // Search is non-critical to boot; log and continue.
      this.logger.warn(`Meilisearch unavailable at startup: ${(err as Error).message}`);
    }
  }

  /**
   * Add/refresh a single article in the index (or remove if no longer public).
   *
   * On publish this normally runs in the worker's fan-out; the API keeps this
   * path for edits to live articles and as the fallback when Redis is absent.
   */
  async syncArticle(articleId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: searchInclude,
    });
    if (!article || !isPublic(article.status as ArticleStatus)) {
      return this.index.remove(articleId);
    }
    await this.index.upsert([article]);
  }

  removeArticle(articleId: string) {
    return this.index.remove(articleId);
  }

  async reindexAll(): Promise<number> {
    const articles = await this.prisma.article.findMany({
      where: { status: { in: ['PUBLISHED', 'UPDATED', 'CORRECTED'] } },
      include: searchInclude,
    });
    await this.index.upsert(articles);
    return articles.length;
  }

  search(query: string, filters: SearchFilters = {}, limit = 20) {
    return this.index.search(query, filters, limit);
  }
}
