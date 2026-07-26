import {
  Newsreader,
  Inter,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
} from 'next/font/google';

/**
 * Font loading is budgeted, not declared casually — the perf sweep found fonts
 * weighing 688KB on mobile, more than every image on the page combined.
 *
 * Two rules:
 *  - Only ship weights and styles the product actually uses. An unused weight
 *    is a file every reader downloads for nothing.
 *  - Only preload what the current locale needs.
 */

/**
 * Headlines. Used at `font-medium` (500) and `font-semibold` (600); 400 stays
 * as the unweighted default. 700 was never used, and italic never applies —
 * headlines are upright, and body emphasis is set in Inter.
 */
export const serif = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-serif',
  display: 'swap',
});

/**
 * Body. Variable font, so weight costs nothing extra — but italic is a separate
 * file, and it is worth it: `<em>` is common in article copy and a synthesised
 * slant looks wrong at reading size.
 */
export const sans = Inter({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-sans',
  display: 'swap',
});

/** Numbers, dates, reading time. */
export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * Arabic (RTL) — Newsreader/Inter don't cover Arabic.
 *
 * `preload: false` is the important part. Declared in the root layout, this
 * was being preloaded on every page in every locale, so English readers paid
 * for four Arabic weights they would never render. Without preload the
 * @font-face still ships and the browser fetches it the moment an Arabic glyph
 * needs painting — which on `/ar` is immediately.
 */
export const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '600'],
  variable: '--font-arabic',
  display: 'swap',
  preload: false,
});

export const fontVariables = `${serif.variable} ${sans.variable} ${mono.variable} ${arabic.variable}`;
