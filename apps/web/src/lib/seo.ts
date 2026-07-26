import 'server-only';
import { LOCALES, type Locale } from '@pressly/types';
import type { Article, ArticleDoc } from '@pressly/types';
import { siteUrl } from './site';

/**
 * Canonicals, hreflang and structured data.
 *
 * Two different problems live here, and they need opposite answers.
 *
 * **Listing pages** (home, topic, country) genuinely differ per locale: the
 * navigation, labels and section headings are translated. Those are language
 * variants of one page, so each self-canonicalises and they declare each other
 * with hreflang.
 *
 * **Articles do not.** A v1 decision keeps article *content* in the language it
 * was written in, so `/ar/article/x` serves the same English body as
 * `/en/article/x` inside Arabic chrome. Four URLs, one article. Declaring those
 * as hreflang alternates would be a false claim — hreflang means "the same
 * content, translated", and nothing here is translated. They are duplicates, so
 * every locale canonicalises to the article's own language and the ranking
 * signals consolidate on one URL instead of splitting four ways.
 */

const ORG_NAME = 'Pressly';

function abs(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Self-canonical plus every locale as an alternate. For listing pages. */
export function localizedMetadata(locale: Locale, path: string) {
  const suffix = path === '/' ? '' : path;
  return {
    alternates: {
      canonical: abs(`/${locale}${suffix}`),
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, abs(`/${l}${suffix}`)])),
        'x-default': abs(`/en${suffix}`),
      },
    },
  };
}

/**
 * One canonical for an article, in the language the article is written in —
 * regardless of which locale the reader arrived through.
 */
export function articleCanonical(article: { slug: string; primaryLanguage: string }): string {
  const lang = (LOCALES as readonly string[]).includes(article.primaryLanguage)
    ? article.primaryLanguage
    : 'en';
  return abs(`/${lang}/article/${article.slug}`);
}

/* ------------------------------------------------------------ structured -- */

/**
 * `Organization` and `WebSite`, emitted once in the root layout.
 *
 * Both carry a stable `@id` so the per-article `publisher` can reference this
 * node instead of restating it — that is what lets a consumer resolve every
 * article to one publisher entity rather than N copies of a name.
 */
export function siteJsonLd() {
  const base = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: ORG_NAME,
        url: base,
      },
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        name: ORG_NAME,
        url: base,
        publisher: { '@id': `${base}/#organization` },
        inLanguage: 'en',
      },
    ],
  };
}

export interface EntityRef {
  name: string;
  url?: string;
}

/**
 * Reads the organisations an article cites out of the article itself.
 *
 * Answer engines lean on `mentions` to decide what a page is *about* rather
 * than inferring it from prose — but populating it normally means a per-article
 * entity field, an editor UI for it, and a writer who remembers to fill it in.
 *
 * The article already contains the answer. When a writer links the words
 * "Saudi Electricity Company" to `se.com.sa`, that anchor text *is* the entity
 * name and the href *is* its canonical identifier — that is what an editorial
 * link means. So the markup is derived from the body instead of duplicated
 * beside it, and it cannot drift from what the page actually says.
 *
 * External links only: an internal link points at this site, which is already
 * the publisher.
 */
export function entitiesFromBody(doc: ArticleDoc): EntityRef[] {
  const found = new Map<string, EntityRef>();

  const walk = (nodes: unknown[]): void => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const n = node as {
        type?: string;
        text?: string;
        marks?: Array<{ type: string; attrs?: { href?: string } }>;
        content?: unknown[];
      };

      if (n.type === 'text' && n.text && n.marks) {
        for (const mark of n.marks) {
          const href = mark.attrs?.href;
          if (mark.type !== 'link' || !href || !/^https?:\/\//.test(href)) continue;
          // First mention wins: the first time a writer links an entity is
          // where they introduce it by its full name.
          if (!found.has(href)) found.set(href, { name: n.text.trim(), url: href });
        }
      }
      if (Array.isArray(n.content)) walk(n.content);
    }
  };

  walk(doc.content as unknown[]);
  return [...found.values()];
}

/**
 * `Article` + `BreadcrumbList` for one story.
 *
 * `about` and `mentions` are the levers that matter for answer engines: they
 * state, in machine-readable form, which organisations this page is *about*
 * rather than leaving a retrieval model to infer it from prose. Passing them is
 * optional because most stories do not need it; a project record does.
 */
export function articleJsonLd(article: Article, opts: { about?: EntityRef[] } = {}) {
  // Cited organisations come from the body's own links — see entitiesFromBody.
  const mentions = entitiesFromBody(article.body);
  const base = siteUrl();
  const url = articleCanonical(article);
  const org = (e: EntityRef) => ({ '@type': 'Organization', name: e.name, ...(e.url ? { url: e.url } : {}) });

  // Local-disk media yields site-relative paths ("/media/…"). Structured data
  // is consumed away from the page, so a relative URL there resolves against
  // whatever host is reading it, or not at all.
  const hero = article.heroImage?.variants.large ?? article.heroImage?.variants.original;
  const images = hero ? [hero.startsWith('/') ? abs(hero) : hero] : undefined;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: article.headline,
        ...(article.summary ? { description: article.summary } : {}),
        ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
        ...(article.publishedAt ? { dateModified: article.publishedAt } : {}),
        inLanguage: article.primaryLanguage,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        url,
        ...(images ? { image: images } : {}),
        // A byline is a person, even when the account behind it is named after
        // the publication. Typing it `Organization` would collapse the author
        // and the publisher into one entity, which is the opposite of the
        // distinction an E-E-A-T assessment is looking for.
        ...(article.author ? { author: { '@type': 'Person', name: article.author.name } } : {}),
        publisher: { '@id': `${base}/#organization` },
        isAccessibleForFree: true,
        ...(opts.about?.length ? { about: opts.about.map(org) } : {}),
        ...(mentions.length ? { mentions: mentions.map(org) } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: ORG_NAME, item: abs(`/${article.primaryLanguage}`) },
          ...(article.topic
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: article.topic.name,
                  item: abs(`/${article.primaryLanguage}/topic/${article.topic.slug}`),
                },
              ]
            : []),
          {
            '@type': 'ListItem',
            position: article.topic ? 3 : 2,
            name: article.headline,
            item: url,
          },
        ],
      },
    ],
  };
}
