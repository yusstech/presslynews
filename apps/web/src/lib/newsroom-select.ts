import 'server-only';
import type { Prisma } from '@pressly/db';
import { ARTICLE_TYPES, LOCALES } from '@pressly/types';

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
  // In the list so a scheduled story can show the date it will go out on,
  // rather than the date it was last touched.
  publishAt: true,
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

/**
 * Turn an autosave body into a validated Prisma update, or an error naming the
 * offending field.
 *
 * `EDITABLE_FIELDS` gates which *keys* may be written. It says nothing about
 * their values, and everything here has a constrained domain: three of these
 * are foreign keys, two are enums, one is a boolean and one is a date. Passing
 * an unchecked value straight through means Prisma raises — a foreign-key
 * violation, an enum mismatch, an Invalid Date — and the autosave returns a
 * 500 with no indication of which field was wrong. A 400 that names the field
 * is both honest and useful, and it keeps genuine 500s meaning "we broke".
 *
 * Existence of a referenced row is *not* checked here; that is a race whatever
 * we do, so the route catches the foreign-key violation instead.
 */
export function buildArticleUpdate(
  body: Record<string, unknown>,
): { data: Prisma.ArticleUpdateInput } | { error: string } {
  const data: Record<string, unknown> = {};

  const isNullableString = (v: unknown) => v === null || typeof v === 'string';

  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    const value = body[field];

    switch (field) {
      case 'bodyJson':
        if (typeof value !== 'object' || value === null) {
          return { error: 'bodyJson must be a document object' };
        }
        data.bodyJson = value;
        // Kept in step with the body on every save; the Reader shows it and it
        // is never edited directly.
        data.readingTime = readingTimeFor(value);
        break;

      case 'articleType':
        if (!(ARTICLE_TYPES as readonly string[]).includes(value as string)) {
          return { error: `articleType must be one of ${ARTICLE_TYPES.join(', ')}` };
        }
        data.articleType = value;
        break;

      case 'primaryLanguage':
        if (!(LOCALES as readonly string[]).includes(value as string)) {
          return { error: `primaryLanguage must be one of ${LOCALES.join(', ')}` };
        }
        data.primaryLanguage = value;
        break;

      case 'isBreaking':
        if (typeof value !== 'boolean') return { error: 'isBreaking must be true or false' };
        data.isBreaking = value;
        break;

      case 'publishAt': {
        if (value === null || value === '') {
          data.publishAt = null;
          break;
        }
        if (typeof value !== 'string') return { error: 'publishAt must be an ISO date or null' };
        const when = new Date(value);
        // An unparseable string becomes Invalid Date, which Prisma rejects far
        // from here with a message that does not mention publishAt.
        if (Number.isNaN(when.getTime())) {
          return { error: `publishAt is not a valid date: "${value}"` };
        }
        data.publishAt = when;
        break;
      }

      default:
        // The remaining fields are free text or an id: a string, or null to
        // clear it.
        if (!isNullableString(value)) return { error: `${field} must be a string or null` };
        data[field] = value;
    }
  }

  return { data: data as Prisma.ArticleUpdateInput };
}

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
    // Apostrophes vanish rather than separate: "Nigeria's Grid" should slug to
    // "nigerias-grid", not "nigeria-s-grid".
    .replace(/['’]/g, '')
    // NFKD splits "é" into "e" plus a combining acute. That is the point — it
    // is what lets an accented letter reduce to its ASCII base — but the
    // accent is a Mark, not a Letter, so the next rule turned it into a
    // separator: "Réseau électrique" became "re-seau-e-lectrique". Drop the
    // marks the decomposition just separated out.
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `story-${suffix}`;
}
