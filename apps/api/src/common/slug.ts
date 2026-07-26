/** Turns a title into a URL-safe slug. Handles Latin; falls back for other scripts. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '') // drop non-latin/punct
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return base || 'article';
}

/** Short random suffix to guarantee slug uniqueness. */
export function randomSuffix(length = 6): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}
