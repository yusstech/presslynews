import { isLocale } from '@pressly/types';
import { getAllPublished } from '@/lib/content-api';
import { siteUrl } from '@/lib/site';

/**
 * Per-locale RSS 2.0 feed.
 *
 * v1 keeps article content in its original language, so the feed is not
 * filtered by locale — the locale in the path sets the link targets and the
 * channel language, which is what a reader's client acts on.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return new Response('Not found', { status: 404 });
  }

  const base = siteUrl();
  const articles = await getAllPublished(50);
  const updated = articles[0]?.publishedAt ?? new Date().toISOString();

  const items = articles
    .map((article) => {
      const url = `${base}/${locale}/article/${article.slug}`;
      const categories = [article.country?.name, article.topic?.name]
        .filter(Boolean)
        .map((name) => `      <category>${escapeXml(name!)}</category>`)
        .join('\n');

      return `    <item>
      <title>${escapeXml(article.headline)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      ${article.author ? `<dc:creator>${escapeXml(article.author.name)}</dc:creator>` : ''}
      <pubDate>${toRfc822(article.publishedAt)}</pubDate>
${categories}
      <description>${escapeXml(article.summary ?? article.subheadline ?? '')}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Pressly</title>
    <link>${base}/${locale}</link>
    <atom:link href="${base}/${locale}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Global news and intelligence, calmly told.</description>
    <language>${locale}</language>
    <lastBuildDate>${toRfc822(updated)}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // Matches the tagged content window; a publish clears it early.
      'cache-control': 'public, max-age=0, s-maxage=300',
    },
  });
}

function toRfc822(value?: string): string {
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toUTCString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
