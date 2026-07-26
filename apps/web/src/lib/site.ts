/**
 * Canonical public origin, without a trailing slash.
 *
 * `SITE_URL` is read first, and it is the one to set in production.
 * `NEXT_PUBLIC_SITE_URL` is inlined into the bundle at build time, which is the
 * wrong lifetime for this value: it feeds canonical tags, `metadataBase`, the
 * sitemap, the RSS feed and every JSON-LD `@id`. Baked in, a deploy that built
 * before the variable was set ships canonicals pointing at localhost — which
 * tells Google the real pages are duplicates of a host it cannot reach.
 *
 * Every caller is server-side (sitemap, robots, feed.xml, metadata, seo.ts), so
 * a runtime variable costs nothing and removes the build-order trap entirely.
 * The public one stays as a fallback because it is already set locally.
 */
export function siteUrl(): string {
  const url = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return url.replace(/\/$/, '');
}
