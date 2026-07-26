import 'server-only';
import type { Prisma } from '@pressly/db';

/**
 * The shape the Newsroom UI expects, defined once.
 *
 * `apps/web/src/newsroom/types.ts` describes it on the client; this is the
 * server half. Keeping them in one file each means a field added to the editor
 * has exactly two places to change, not eight route handlers.
 */
export const articleSummarySelect = {
  id: true,
  workingTitle: true,
  headline: true,
  slug: true,
  status: true,
  articleType: true,
  primaryLanguage: true,
  readingTime: true,
  isBreaking: true,
  updatedAt: true,
  publishedAt: true,
  author: { select: { id: true, name: true } },
  country: { select: { id: true, name: true, code: true } },
  topic: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ArticleSelect;

export const articleDetailSelect = {
  ...articleSummarySelect,
  subheadline: true,
  summary: true,
  bodyJson: true,
  version: true,
  seoTitle: true,
  metaDescription: true,
  countryId: true,
  topicId: true,
  heroImageId: true,
  heroImage: { select: { id: true, alt: true, variants: true } },
  publishAt: true,
  statusEvents: {
    select: { id: true, fromStatus: true, toStatus: true, comment: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  },
} satisfies Prisma.ArticleSelect;

/** Fields the editor is allowed to write. Anything else in the body is ignored
 *  — status changes go through the publish route, not a PATCH. */
export const EDITABLE_FIELDS = [
  'workingTitle',
  'headline',
  'subheadline',
  'summary',
  'bodyJson',
  'articleType',
  'primaryLanguage',
  'isBreaking',
  'seoTitle',
  'metaDescription',
  'countryId',
  'topicId',
  'heroImageId',
  'publishAt',
] as const;

/** Rough reading time, matching what the API computed on save. */
export function readingTimeFor(bodyJson: unknown): number {
  const text = JSON.stringify(bodyJson ?? {});
  const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  return Math.max(1, Math.round(words / 200));
}

/** URL-safe slug with a short suffix so two drafts sharing a headline don't
 *  collide on the unique index. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `story-${suffix}`;
}
