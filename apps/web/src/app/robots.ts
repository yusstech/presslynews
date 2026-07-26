import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The newsroom is authenticated, but there is no reason to crawl it.
      disallow: ['/api/', '/*/newsroom'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
