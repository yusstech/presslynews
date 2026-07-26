import type { Article, ArticleCard, ArticleDoc, MediaVariants } from '@pressly/types';

/**
 * Server-side client for the public content API. The Reader renders live
 * data published from the Newsroom (previously it used local seed data).
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ApiMedia {
  id: string;
  alt: string | null;
  variants: MediaVariants;
  focalPointX: number | null;
  focalPointY: number | null;
}

interface ApiArticle {
  id: string;
  slug: string;
  headline: string;
  subheadline: string | null;
  summary: string | null;
  bodyJson: ArticleDoc;
  status: Article['status'];
  primaryLanguage: string;
  readingTime: number;
  isBreaking: boolean;
  articleType: Article['articleType'];
  publishedAt: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  socialImageUrl: string | null;
  author: { id: string; name: string; slug: string; role: string } | null;
  country: { id: string; code: string; name: string; region: string; defaultLanguage: string } | null;
  topic: { id: string; slug: string; name: string } | null;
  heroImage: ApiMedia | null;
}

/**
 * Cached content reads are tagged so the worker can drop exactly the affected
 * pages on publish (see /api/revalidate). The time-based window is a safety net
 * for the case where that call never arrives. Passing no tags opts out of
 * caching entirely — used for search, where results must always be live.
 */
async function get<T>(path: string, tags?: string[]): Promise<T | null> {
  try {
    const res = await fetch(
      `${BASE}/api${path}`,
      tags ? { next: { tags, revalidate: 300 } } : { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Tag applied to every published-content read. */
export const CONTENT_TAG = 'content';
export const articleTag = (slug: string) => `article:${slug}`;

function toCard(a: ApiArticle): ArticleCard {
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
          variants: a.heroImage.variants,
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
    author: a.author
      ? { id: a.author.id, name: a.author.name, slug: a.author.slug, role: 'JOURNALIST' }
      : undefined,
    articleType: a.articleType,
    isBreaking: a.isBreaking,
    publishedAt: a.publishedAt ?? undefined,
  };
}

function toArticle(a: ApiArticle): Article {
  return {
    ...toCard(a),
    body: a.bodyJson,
    status: a.status,
    seoTitle: a.seoTitle ?? undefined,
    metaDescription: a.metaDescription ?? undefined,
    socialImageUrl: a.socialImageUrl ?? undefined,
  };
}

export interface HomeData {
  hero: ArticleCard | null;
  breaking: ArticleCard[];
  latest: ArticleCard[];
  editorsPicks: ArticleCard[];
}

export async function getHome(): Promise<HomeData> {
  const data = await get<{
    hero: ApiArticle | null;
    breaking: ApiArticle[];
    latest: ApiArticle[];
    editorsPicks: ApiArticle[];
  }>('/content/home', [CONTENT_TAG]);
  if (!data) return { hero: null, breaking: [], latest: [], editorsPicks: [] };
  return {
    hero: data.hero ? toCard(data.hero) : null,
    breaking: data.breaking.map(toCard),
    latest: data.latest.map(toCard),
    editorsPicks: data.editorsPicks.map(toCard),
  };
}

export async function getArticle(slug: string): Promise<Article | null> {
  const a = await get<ApiArticle>(`/content/articles/${slug}`, [CONTENT_TAG, articleTag(slug)]);
  return a ? toArticle(a) : null;
}

export async function getByCountry(code: string): Promise<ArticleCard[]> {
  const list = await get<ApiArticle[]>(`/content/countries/${code}/articles`, [CONTENT_TAG]);
  return (list ?? []).map(toCard);
}

export async function getByTopic(slug: string): Promise<ArticleCard[]> {
  const list = await get<ApiArticle[]>(`/content/topics/${slug}/articles`, [CONTENT_TAG]);
  return (list ?? []).map(toCard);
}

/** Flat list of everything public — backs the RSS feed and the sitemap. */
export async function getAllPublished(limit = 200): Promise<ArticleCard[]> {
  const list = await get<ApiArticle[]>(`/content/articles?limit=${limit}`, [CONTENT_TAG]);
  return (list ?? []).map(toCard);
}

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

export async function getCountries(): Promise<CountryRef[]> {
  return (await get<CountryRef[]>('/taxonomy/countries', [CONTENT_TAG])) ?? [];
}

export async function getCountry(code: string): Promise<CountryRef | null> {
  const list = await getCountries();
  return list.find((c) => c.code === code) ?? null;
}

export async function getTopics(): Promise<TopicRef[]> {
  return (await get<TopicRef[]>('/taxonomy/topics', [CONTENT_TAG])) ?? [];
}

export async function getTopic(slug: string): Promise<TopicRef | null> {
  const list = await getTopics();
  return list.find((t) => t.slug === slug) ?? null;
}

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

export async function searchContent(q: string): Promise<SearchHit[]> {
  const hits = await get<SearchHit[]>(`/search?q=${encodeURIComponent(q)}`);
  return hits ?? [];
}
