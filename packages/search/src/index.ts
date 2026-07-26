import { MeiliSearch, type Index } from 'meilisearch';
import { extractPlainText, type ArticleDoc } from '@pressly/types';

const INDEX = 'articles';

/** The article shape the index needs — structural, so callers can pass a Prisma row. */
export interface IndexableArticle {
  id: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  summary: string | null;
  bodyJson: unknown;
  primaryLanguage: string;
  articleType: string;
  readingTime: number;
  isBreaking: boolean;
  publishedAt: Date | null;
  author: { name: string } | null;
  country: { name: string; code: string } | null;
  topic: { name: string; slug: string } | null;
}

export interface SearchFilters {
  country?: string;
  topic?: string;
  language?: string;
  type?: string;
}

/**
 * The articles index. One implementation shared by both processes: the API
 * queries it for the Reader, and the BullMQ worker writes to it during publish
 * fan-out (with the API keeping an inline write path for when Redis is absent).
 */
export class ArticleSearchIndex {
  private client: MeiliSearch;
  private index: Index;

  constructor(host = process.env.MEILISEARCH_HOST, apiKey = process.env.MEILISEARCH_KEY) {
    this.client = new MeiliSearch({ host: host ?? 'http://localhost:7700', apiKey });
    this.index = this.client.index(INDEX);
  }

  async ensureIndex() {
    await this.client.createIndex(INDEX, { primaryKey: 'id' }).catch(() => undefined);
    await this.index.updateSettings({
      searchableAttributes: [
        'headline',
        'subheadline',
        'summary',
        'bodyText',
        'authorName',
        'countryName',
        'topicName',
      ],
      filterableAttributes: ['countryCode', 'topicSlug', 'language', 'articleType'],
      sortableAttributes: ['publishedAt'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    });
  }

  async upsert(articles: IndexableArticle[]) {
    if (articles.length === 0) return;
    await this.index.addDocuments(articles.map((a) => toDocument(a)));
  }

  async remove(articleId: string) {
    await this.index.deleteDocument(articleId).catch(() => undefined);
  }

  async search(query: string, filters: SearchFilters = {}, limit = 20) {
    const filterExpr: string[] = [];
    if (filters.country) filterExpr.push(`countryCode = "${filters.country}"`);
    if (filters.topic) filterExpr.push(`topicSlug = "${filters.topic}"`);
    if (filters.language) filterExpr.push(`language = "${filters.language}"`);
    if (filters.type) filterExpr.push(`articleType = "${filters.type}"`);

    const res = await this.index.search(query, {
      limit,
      filter: filterExpr.length ? filterExpr.join(' AND ') : undefined,
    });
    return res.hits;
  }
}

function toDocument(article: IndexableArticle) {
  return {
    id: article.id,
    slug: article.slug,
    headline: article.headline,
    subheadline: article.subheadline,
    summary: article.summary,
    bodyText: extractPlainText(article.bodyJson as ArticleDoc).slice(0, 4000),
    authorName: article.author?.name ?? null,
    countryName: article.country?.name ?? null,
    countryCode: article.country?.code ?? null,
    topicName: article.topic?.name ?? null,
    topicSlug: article.topic?.slug ?? null,
    language: article.primaryLanguage,
    articleType: article.articleType,
    readingTime: article.readingTime,
    isBreaking: article.isBreaking,
    publishedAt: article.publishedAt ? article.publishedAt.getTime() : 0,
  };
}
