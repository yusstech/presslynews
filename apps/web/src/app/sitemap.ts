import type { MetadataRoute } from 'next';
import { LOCALES } from '@pressly/types';
import { getAllPublished, getCountries, getTopics } from '@/lib/content-api';
import { siteUrl } from '@/lib/site';

/**
 * Sitemap covering every locale of every public page.
 *
 * Each URL carries hreflang alternates for its siblings, which is what tells a
 * search engine these are translations of one page rather than duplicates —
 * the thing that matters most for a site whose whole premise is four editions.
 */
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
  add('/search', undefined, 0.3);

  for (const article of articles) {
    add(`/article/${article.slug}`, article.publishedAt, 0.8);
  }
  for (const country of countries) {
    add(`/country/${country.code}`, undefined, 0.5);
  }
  for (const topic of topics) {
    add(`/topic/${topic.slug}`, undefined, 0.5);
  }

  return entries;
}
