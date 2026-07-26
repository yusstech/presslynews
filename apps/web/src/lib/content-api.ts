import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Prisma } from '@pressly/db';
import type { Article, ArticleCard, ArticleDoc, MediaVariants } from '@pressly/types';
import { prisma } from './prisma';

/**
 * The Reader's data layer.
 *
 * This used to `fetch` a NestJS API over HTTP. That service existed to be a
 * boundary between processes — with a single Next.js app there is no boundary
 * left, only a network hop between two things in the same process. The queries
 * are unchanged; the transport is gone.
 *
 * Caching is deliberately unchanged too: every read is wrapped in
 * `unstable_cache` under the SAME tag names the fetch calls used, so
 * `revalidateTag` still drops exactly the right pages on publish.
 *
 * `server-only` makes it a build error to import this from a client component,
 * where it would try to bundle the database client.
 */

/** Tag applied to every published-content read. */
export const CONTENT_TAG = 'content';
export const articleTag = (slug: string) => `article:${slug}`;

/** Safety net for the case where a revalidate call never arrives. */
const REVALIDATE_SECONDS = 300;

const cardInclude = {
  author: { select: { id: true, name: true, slug: true } },
  country: true,
  topic: true,
  heroImage: true,
} satisfies Prisma.ArticleInclude;

type ArticleRow = Prisma.ArticleGetPayload<{ include: typeof cardInclude }>;

/**
 * A story is public when it is PUBLISHED and its publish time has passed.
 * The time check matters: a scheduled story that the cron has not yet released
 * stays hidden even if its status was set early.
 */
function publishedWhere(extra: Prisma.ArticleWhereInput = {}): Prisma.ArticleWhereInput {
  return { status: 'PUBLISHED', publishedAt: { lte: new Date() }, ...extra };
}

function toCard(a: ArticleRow): ArticleCard {
  return {
    id: a.id,
    slug: a.slug,
    headline: a.headline,
    subheadline: a.subheadline ?? undefined,
    summary: a.summary ?? undefined,
    heroImage: a.heroImage
      ? {
          id: a.heroImage.id,
          alt: a.heroImage.alt ?? undefined,
          caption: a.heroImage.caption ?? undefined,
          photographer: a.heroImage.photographer ?? undefined,
          variants: a.heroImage.variants as unknown as MediaVariants,
          focalPoint:
            a.heroImage.focalPointX != null && a.heroImage.focalPointY != null
              ? { x: a.heroImage.focalPointX, y: a.heroImage.focalPointY }
              : undefined,
        }
      : undefined,
    readingTime: a.readingTime,
    primaryLanguage: a.primaryLanguage as ArticleCard['primaryLanguage'],
    country: a.country
      ? {
          id: a.country.id,
          code: a.country.code,
          name: a.country.name,
          region: a.country.region,
          defaultLanguage: a.country.defaultLanguage as ArticleCard['primaryLanguage'],
        }
      : undefined,
    topic: a.topic ? { id: a.topic.id, slug: a.topic.slug, name: a.topic.name } : undefined,
    author: a.author ? { id: a.author.id, name: a.author.name, slug: a.author.slug } : undefined,
    articleType: a.articleType,
    isBreaking: a.isBreaking,
    publishedAt: a.publishedAt?.toISOString() ?? undefined,
  };
}

function toArticle(a: ArticleRow): Article {
  return {
    ...toCard(a),
    body: a.bodyJson as unknown as ArticleDoc,
    status: a.status,
    seoTitle: a.seoTitle ?? undefined,
    metaDescription: a.metaDescription ?? undefined,
    socialImageUrl: a.socialImageUrl ?? undefined,
  };
}

/* ------------------------------------------------------------------ reads -- */

export interface HomeData {
  hero: ArticleCard | null;
  breaking: ArticleCard[];
  latest: ArticleCard[];
  editorsPicks: ArticleCard[];
}

const listPublished = (limit: number) =>
  prisma.article.findMany({
    where: publishedWhere(),
    include: cardInclude,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });

export const getHome = unstable_cache(
  async (): Promise<HomeData> => {
    const all = await listPublished(30);
    const [hero, ...rest] = all;
    return {
      hero: hero ? toCard(hero) : null,
      breaking: all.filter((a) => a.isBreaking).map(toCard),
      latest: rest.slice(0, 6).map(toCard),
      editorsPicks: all
        .filter((a) => a.articleType === 'FEATURE')
        .slice(0, 4)
        .map(toCard),
    };
  },
  ['home'],
  { tags: [CONTENT_TAG], revalidate: REVALIDATE_SECONDS },
);

export async function getArticle(slug: string): Promise<Article | null> {
  // Keyed per slug: the tag list is per-slug, so the cache key must be too or
  // every article would share one entry.
  return unstable_cache(
    async () => {
      const a = await prisma.article.findFirst({
        where: publishedWhere({ slug }),
        include: cardInclude,
      });
      return a ? toArticle(a) : null;
    },
    ['article', slug],
    { tags: [CONTENT_TAG, articleTag(slug)], revalidate: REVALIDATE_SECONDS },
  )();
}

export async function getByCountry(code: string): Promise<ArticleCard[]> {
  return unstable_cache(
    async () =>
      (
        await prisma.article.findMany({
          where: publishedWhere({ country: { code } }),
          include: cardInclude,
          orderBy: { publishedAt: 'desc' },
        })
      ).map(toCard),
    ['by-country', code],
    { tags: [CONTENT_TAG], revalidate: REVALIDATE_SECONDS },
  )();
}

export async function getByTopic(slug: string): Promise<ArticleCard[]> {
  return unstable_cache(
    async () =>
      (
        await prisma.article.findMany({
          where: publishedWhere({ topic: { slug } }),
          include: cardInclude,
          orderBy: { publishedAt: 'desc' },
        })
      ).map(toCard),
    ['by-topic', slug],
    { tags: [CONTENT_TAG], revalidate: REVALIDATE_SECONDS },
  )();
}

/** Flat list of everything public — backs the RSS feed and the sitemap. */
export const getAllPublished = unstable_cache(
  async (limit = 200): Promise<ArticleCard[]> => (await listPublished(limit)).map(toCard),
  ['all-published'],
  { tags: [CONTENT_TAG], revalidate: REVALIDATE_SECONDS },
);

/* --------------------------------------------------------------- taxonomy -- */

export interface CountryRef {
  id: string;
  code: string;
  name: string;
  region: string;
  defaultLanguage: string;
}
export interface TopicRef {
  id: string;
  slug: string;
  name: string;
}

export const getCountries = unstable_cache(
  async (): Promise<CountryRef[]> =>
    prisma.country.findMany({
      select: { id: true, code: true, name: true, region: true, defaultLanguage: true },
      orderBy: { name: 'asc' },
    }),
  ['countries'],
  { tags: [CONTENT_TAG], revalidate: REVALIDATE_SECONDS },
);

export async function getCountry(code: string): Promise<CountryRef | null> {
  return (await getCountries()).find((c) => c.code === code) ?? null;
}

export const getTopics = unstable_cache(
  async (): Promise<TopicRef[]> =>
    prisma.topic.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ['topics'],
  { tags: [CONTENT_TAG], revalidate: REVALIDATE_SECONDS },
);

export async function getTopic(slug: string): Promise<TopicRef | null> {
  return (await getTopics()).find((t) => t.slug === slug) ?? null;
}

/* ----------------------------------------------------------------- search -- */

export interface SearchHit {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  countryName: string | null;
  topicName: string | null;
  language: string;
  readingTime: number;
}

/**
 * Postgres full-text search, replacing Meilisearch. Deliberately uncached —
 * results must always be live.
 *
 * `websearch_to_tsquery` rather than `plainto_tsquery`: it understands quoted
 * phrases and `-exclusions`, and it never throws on punctuation a reader types
 * by accident. The text-search configuration is chosen per row from
 * `primaryLanguage`, so an Arabic story is matched with the Arabic stemmer
 * rather than the English one.
 *
 * What is lost against Meilisearch is typo tolerance. At this scale that is an
 * acceptable trade for deleting a service.
 */
export async function searchContent(q: string, limit = 20): Promise<SearchHit[]> {
  const query = q.trim();
  if (!query) return [];

  return prisma.$queryRaw<SearchHit[]>`
    WITH q AS (
      SELECT a.id,
             CASE a."primaryLanguage"
               WHEN 'ar' THEN 'arabic'::regconfig
               WHEN 'fr' THEN 'french'::regconfig
               WHEN 'de' THEN 'german'::regconfig
               ELSE 'english'::regconfig
             END AS cfg
      FROM "Article" a
    )
    SELECT a.id,
           a.slug,
           a.headline,
           a.summary,
           c.name AS "countryName",
           t.name AS "topicName",
           a."primaryLanguage" AS language,
           a."readingTime"
    FROM "Article" a
    JOIN q ON q.id = a.id
    LEFT JOIN "Country" c ON c.id = a."countryId"
    LEFT JOIN "Topic" t ON t.id = a."topicId"
    WHERE a.status = 'PUBLISHED'
      AND a."publishedAt" <= now()
      AND a."searchVector" @@ websearch_to_tsquery(q.cfg, ${query})
    ORDER BY ts_rank(a."searchVector", websearch_to_tsquery(q.cfg, ${query})) DESC,
             a."publishedAt" DESC
    LIMIT ${limit}
  `;
}
