/**
 * Read-model shapes shared between the API, Reader, and Newsroom.
 * These are transport DTOs (JSON-serializable), not Prisma models.
 */

import type { ArticleDoc } from './article-body';
import type { ArticleStatus, ArticleType, MediaProcessingStatus } from './enums';
import type { Locale, TextDirection } from './locales';

export interface AuthorSummary {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
}

export interface CountrySummary {
  id: string;
  /** ISO 3166-1 alpha-2, lowercase (e.g. "sa", "ng"). */
  code: string;
  name: string;
  region: string;
  defaultLanguage: Locale;
}

export interface LanguageSummary {
  code: Locale;
  name: string;
  direction: TextDirection;
}

export interface TopicSummary {
  id: string;
  slug: string;
  name: string;
}

/** The set of responsive/format variants generated for every uploaded image. */
export interface MediaVariants {
  original: string;
  large?: string;
  tablet?: string;
  mobile?: string;
  thumb?: string;
  /** Legacy single WebP of the largest size. Superseded by `webpSet`. */
  webp?: string;
  avif?: string;
  social?: string;
  /**
   * WebP at every responsive width.
   *
   * Added because JPEG-only delivery meant a 2× phone pulled the 1024px crop
   * for each card — 915KB on the home page. WebP at the same widths is roughly
   * half that. Optional so media recorded before this existed still resolves;
   * the Reader falls back to the JPEG `srcSet` when it is absent.
   */
  webpSet?: Partial<Record<'thumb' | 'mobile' | 'tablet' | 'large', string>>;
}

export interface Media {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  photographer?: string;
  /** Required for externally sourced media. */
  copyrightHolder?: string;
  usageRights?: string;
  focalPoint?: { x: number; y: number };
  processingStatus: MediaProcessingStatus;
  variants: MediaVariants;
}

/** Compact article shape for cards, lists, search results. */
export interface ArticleCard {
  id: string;
  slug: string;
  headline: string;
  subheadline?: string;
  summary?: string;
  heroImage?: Pick<Media, 'id' | 'alt' | 'variants' | 'focalPoint' | 'caption' | 'photographer'>;
  readingTime: number;
  primaryLanguage: Locale;
  country?: CountrySummary;
  topic?: TopicSummary;
  author?: AuthorSummary;
  articleType: ArticleType;
  isBreaking: boolean;
  publishedAt?: string;
}

/** Full article for the reading page. */
export interface Article extends ArticleCard {
  body: ArticleDoc;
  status: ArticleStatus;
  seoTitle?: string;
  metaDescription?: string;
  socialHeadline?: string;
  socialDescription?: string;
  socialImage?: Pick<Media, 'id' | 'variants'>;
  /** og:image card rendered by the worker during publish fan-out. */
  socialImageUrl?: string;
  sources?: ArticleSource[];
  relatedArticleIds?: string[];
  updatedAt?: string;
}

export interface ArticleSource {
  label: string;
  url?: string;
}

export interface ArticleStatusEvent {
  id: string;
  fromStatus: ArticleStatus | null;
  toStatus: ArticleStatus;
  actor: Pick<AuthorSummary, 'id' | 'name'>;
  comment?: string;
  articleVersion: number;
  createdAt: string;
}
