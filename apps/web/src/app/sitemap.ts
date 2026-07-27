import type { MetadataRoute } from 'next';
import { LOCALES } from '@pressly/types';
import { getAllPublished, getCountries, getTopics } from '@/lib/content-api';
import { siteUrl } from '@/lib/site';

/**
 * Sitemap of canonical URLs.
 *
 * Listing pages appear once per locale with hreflang alternates: their chrome
 * really is translated, so they are language variants of one page.
 *
 * **Articles appear once.** Their content is not translated — `/ar/article/x`
 * serves the same English body as `/en/article/x` — so all four canonicalise to
 * the article's own language. Listing the other three here would submit URLs
 * this site's own canonical tags disown, which is a contradiction a crawler
 * resolves by trusting neither signal.
 *
 * Rendered per request rather than at build time. `siteUrl()` is a runtime
 * value, and a prerendered sitemap freezes whatever origin the build machine
 * had — `http://localhost:3000`, on a build that ran before SITE_URL was set.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [articles, countries, topics] = await Promise.all([
    getAllPublished(500),
    getCountries(),
    getTopics(),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  const add = (path: string, lastModified?: string | Date, priority = 0.6) => {
    for (const locale of LOCALES) {
      entries.push({
        url: `${base}/${locale}${path}`,
        lastModified: lastModified ? new Date(lastModified) : undefined,
        priority,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((alt) => [alt, `${base}/${alt}${path}`]),
          ),
        },
      });
    }
  };

  add('', articles[0]?.publishedAt, 1);

  // One entry per article, at its canonical locale. `/search` is absent
  // deliberately — it carries `noindex`, and submitting a page you have asked
  // not to be indexed just wastes crawl budget.
  for (const article of articles) {
    const lang = (LOCALES as readonly string[]).includes(article.primaryLanguage)
      ? article.primaryLanguage
      : 'en';
    entries.push({
      url: `${base}/${lang}/article/${article.slug}`,
      lastModified: article.publishedAt ? new Date(article.publishedAt) : undefined,
      priority: 0.8,
    });
  }
  // The glossary appears once, for the same reason articles do: its definitions
  // are English at every locale prefix, so `/ar/glossary` canonicalises to the
  // English URL rather than declaring itself a translation of it.
  entries.push({ url: `${base}/en/glossary`, priority: 0.5 });

  for (const country of countries) {
    add(`/country/${country.code}`, undefined, 0.5);
  }
  for (const topic of topics) {
    add(`/topic/${topic.slug}`, undefined, 0.5);
  }

  return entries;
}
