import { describe, expect, it } from 'vitest';
import {
  articleCanonical,
  englishCanonical,
  entitiesFromBody,
  glossaryJsonLd,
  localizedMetadata,
} from '@/lib/seo';
import type { ArticleDoc } from '@pressly/types';

const ORIGIN = 'https://www.presslynews.com';

/** A Tiptap-shaped document containing the given inline nodes in one paragraph. */
function doc(content: unknown[]): ArticleDoc {
  return { type: 'doc', content: [{ type: 'paragraph', content }] } as unknown as ArticleDoc;
}

function link(text: string, href: string) {
  return { type: 'text', text, marks: [{ type: 'link', attrs: { href } }] };
}

describe('canonical policy', () => {
  it('points every locale of an article at the language it was written in', () => {
    const article = { slug: 'tabuk-line', primaryLanguage: 'en' };
    // The point of the policy: a reader arriving via /ar still consolidates on
    // /en, because the body is not translated.
    expect(articleCanonical(article)).toBe(`${ORIGIN}/en/article/tabuk-line`);
  });

  it('honours an article actually written in another language', () => {
    expect(articleCanonical({ slug: 'x', primaryLanguage: 'ar' })).toBe(`${ORIGIN}/ar/article/x`);
  });

  it('falls back to English for a language outside the launch set', () => {
    // A primaryLanguage of 'es' would otherwise produce /es/article/x — a URL
    // that 404s, offered to Google as the canonical.
    expect(articleCanonical({ slug: 'x', primaryLanguage: 'es' })).toBe(`${ORIGIN}/en/article/x`);
  });

  it('gives listing pages a self-canonical and every locale as an alternate', () => {
    const meta = localizedMetadata('fr', '/topic/energy');
    expect(meta.alternates.canonical).toBe(`${ORIGIN}/fr/topic/energy`);
    expect(meta.alternates.languages).toMatchObject({
      en: `${ORIGIN}/en/topic/energy`,
      ar: `${ORIGIN}/ar/topic/energy`,
      fr: `${ORIGIN}/fr/topic/energy`,
      de: `${ORIGIN}/de/topic/energy`,
      'x-default': `${ORIGIN}/en/topic/energy`,
    });
  });

  it('does not double the slash on the home page', () => {
    expect(localizedMetadata('en', '/').alternates.canonical).toBe(`${ORIGIN}/en`);
  });

  it('sends an English-only page to /en and declares no alternates', () => {
    const meta = englishCanonical('/glossary');
    expect(meta.alternates.canonical).toBe(`${ORIGIN}/en/glossary`);
    // hreflang would assert a translation that does not exist.
    expect(meta.alternates).not.toHaveProperty('languages');
  });
});

describe('entitiesFromBody', () => {
  it('reads a linked organisation out of the body', () => {
    const entities = entitiesFromBody(
      doc([{ type: 'text', text: 'Awarded by ' }, link('Ministry of Energy', 'https://moe.gov.sa')]),
    );
    expect(entities).toEqual([{ name: 'Ministry of Energy', url: 'https://moe.gov.sa' }]);
  });

  it('ignores internal links — this site is already the publisher', () => {
    expect(entitiesFromBody(doc([link('OPGW', '/en/glossary#opgw')]))).toEqual([]);
  });

  it('keeps the first mention, where a writer introduces the full name', () => {
    const entities = entitiesFromBody(
      doc([
        link('Transmission Company of Nigeria', 'https://tcn.org.ng'),
        { type: 'text', text: ' and later ' },
        link('TCN', 'https://tcn.org.ng'),
      ]),
    );
    expect(entities).toEqual([
      { name: 'Transmission Company of Nigeria', url: 'https://tcn.org.ng' },
    ]);
  });

  it('walks nested content rather than only the top level', () => {
    const nested = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [link('REA', 'https://rea.gov.ng')] }] },
          ],
        },
      ],
    } as unknown as ArticleDoc;
    expect(entitiesFromBody(nested)).toEqual([{ name: 'REA', url: 'https://rea.gov.ng' }]);
  });

  it('survives a body with no links at all', () => {
    expect(entitiesFromBody(doc([{ type: 'text', text: 'Plain prose.' }]))).toEqual([]);
  });
});

describe('glossaryJsonLd', () => {
  const terms = [
    { slug: 'opgw', term: 'OPGW', definition: 'A cable that does two jobs.' },
    { slug: 'bay', term: 'Bay', definition: 'A controlled connection.' },
  ];
  const ld = glossaryJsonLd(terms, { name: 'Glossary', description: 'Terms.' }) as {
    '@graph': Array<Record<string, unknown>>;
  };
  const set = ld['@graph'].find((n) => n['@type'] === 'DefinedTermSet') as Record<string, unknown>;

  it('gives each term a citable @id at the anchor it renders behind', () => {
    const defined = set.hasDefinedTerm as Array<Record<string, unknown>>;
    expect(defined.map((t) => t['@id'])).toEqual([
      `${ORIGIN}/en/glossary#opgw`,
      `${ORIGIN}/en/glossary#bay`,
    ]);
  });

  it('ties every term back to the set so they resolve as one vocabulary', () => {
    const defined = set.hasDefinedTerm as Array<Record<string, unknown>>;
    for (const term of defined) {
      expect(term.inDefinedTermSet).toEqual({ '@id': `${ORIGIN}/en/glossary#glossary` });
    }
  });

  it('references the site Organization instead of restating it', () => {
    expect(set.publisher).toEqual({ '@id': `${ORIGIN}/#organization` });
  });

  it('emits breadcrumbs ending at the glossary', () => {
    const crumbs = ld['@graph'].find((n) => n['@type'] === 'BreadcrumbList') as {
      itemListElement: Array<{ position: number; item: string }>;
    };
    expect(crumbs.itemListElement.at(-1)).toMatchObject({
      position: 2,
      item: `${ORIGIN}/en/glossary`,
    });
  });
});
