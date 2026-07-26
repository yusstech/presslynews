import type { MediaVariants } from '@pressly/types';

/**
 * Turns the media pipeline's variants into a `srcSet`.
 *
 * The pipeline has always produced four widths (320 / 640 / 1024 / 1600), but
 * every `<img>` in the Reader asked for exactly one of them — so a phone
 * downloaded the 1024px tablet crop for a 343px-wide card, and the article
 * page served the untouched `original`. The variants existed; nothing used
 * them.
 *
 * Widths must match `SIZES` in apps/api/src/media/media.service.ts and the
 * copy of it in packages/db/prisma/seed-media.ts.
 */
const WIDTHS: Array<[keyof MediaVariants, number]> = [
  ['thumb', 320],
  ['mobile', 640],
  ['tablet', 1024],
  ['large', 1600],
];

export function srcSetFrom(variants: MediaVariants | undefined): string | undefined {
  if (!variants) return undefined;
  const entries = WIDTHS.filter(([key]) => variants[key]).map(
    ([key, w]) => `${variants[key]} ${w}w`,
  );
  // A single candidate is no better than a plain `src` — don't emit noise.
  return entries.length > 1 ? entries.join(', ') : undefined;
}

/**
 * The WebP `srcSet`, when the pipeline produced one. Media recorded before
 * `webpSet` existed returns undefined and the JPEG set is used instead.
 */
export function webpSrcSetFrom(variants: MediaVariants | undefined): string | undefined {
  const set = variants?.webpSet;
  if (!set) return undefined;
  const entries = WIDTHS.filter(([key]) => set[key as keyof typeof set]).map(
    ([key, w]) => `${set[key as keyof typeof set]} ${w}w`,
  );
  return entries.length > 1 ? entries.join(', ') : undefined;
}

/**
 * `sizes` declarations, kept here rather than inline so the layout assumptions
 * are stated once and reviewed together when the grid changes.
 */
export const SIZES = {
  /** Latest/topic/country grid: 3 up on desktop, 2 on tablet, 1 on mobile. */
  card: '(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw',
  /** Compact list row thumbnail — fixed 112px box. */
  rowThumb: '112px',
  /** Home hero: 3fr of a 3fr/2fr split inside the 1440px container. */
  homeHero: '(min-width: 1440px) 840px, (min-width: 768px) 58vw, 92vw',
  /** Article hero: full content width, capped by the container. */
  articleHero: '(min-width: 1440px) 1440px, 100vw',
} as const;

/** Best single `src` for browsers that ignore srcSet, and as the fallback. */
export function fallbackSrc(variants: MediaVariants | undefined): string | undefined {
  if (!variants) return undefined;
  return variants.tablet ?? variants.large ?? variants.original;
}
