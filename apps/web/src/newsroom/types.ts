import type { ArticleStatus, ArticleType } from '@pressly/types';

export interface NewsroomArticleSummary {
  id: string;
  workingTitle: string;
  headline: string;
  slug: string;
  status: ArticleStatus;
  articleType: ArticleType;
  primaryLanguage: string;
  readingTime: number;
  isBreaking: boolean;
  updatedAt: string;
  publishedAt: string | null;
  author?: { id: string; name: string } | null;
  country?: { id: string; name: string; code: string } | null;
  topic?: { id: string; name: string; slug: string } | null;
}

export interface NewsroomStatusEvent {
  id: string;
  fromStatus: ArticleStatus | null;
  toStatus: ArticleStatus;
  comment: string | null;
  createdAt: string;
}

export interface NewsroomMedia {
  id: string;
  alt: string | null;
  variants: { original: string; large?: string; tablet?: string; thumb?: string };
}

export interface NewsroomArticle extends NewsroomArticleSummary {
  subheadline: string | null;
  summary: string | null;
  bodyJson: Record<string, unknown>;
  version: number;
  seoTitle: string | null;
  metaDescription: string | null;
  countryId: string | null;
  topicId: string | null;
  heroImageId: string | null;
  heroImage: NewsroomMedia | null;
  publishAt: string | null;
  statusEvents?: NewsroomStatusEvent[];
}
