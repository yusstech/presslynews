import { describe, expect, it } from 'vitest';
import { ALL_TERMS, GLOSSARY } from '@/content/glossary';

/**
 * The glossary is data, and its links are the reason it exists. These check the
 * things that break silently: a duplicate anchor, an entry pointing at an
 * article slug that does not exist, a definition that does not define.
 */

/**
 * The five project records. Glossary entries point at these rather than at the
 * market analyses, which cite the glossary rather than being cited by it — a
 * `seeAlso` outside this set is a typo.
 */
const PUBLISHED = new Set([
  'samaya-group-completes-the-tabuk-380-kv-transmission-line',
  'samaya-group-completes-the-al-jawf-380-kv-transmission-line',
  'icco-completes-the-rural-damascus-daraa-400-kv-transmission-line',
  'icco-delivers-the-kwara-330-kv-transmission-substation',
  'icco-delivers-the-nnewi-800-mva-transmission-substation',
]);

describe('glossary structure', () => {
  it('has terms in every section', () => {
    for (const section of GLOSSARY) expect(section.terms.length).toBeGreaterThan(0);
  });

  it('flattens to every term exactly once', () => {
    expect(ALL_TERMS).toHaveLength(GLOSSARY.reduce((n, s) => n + s.terms.length, 0));
  });

  it('gives every term a unique anchor', () => {
    // Two terms sharing a slug means one anchor is unreachable and the
    // DefinedTerm @ids collide.
    const slugs = ALL_TERMS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('does not collide a term anchor with a section anchor', () => {
    const sections = new Set(GLOSSARY.map((s) => s.slug));
    for (const term of ALL_TERMS) expect(sections.has(term.slug)).toBe(false);
  });

  it('uses URL-safe anchors', () => {
    for (const term of ALL_TERMS) expect(term.slug).toMatch(/^[a-z0-9-]+$/);
    for (const section of GLOSSARY) expect(section.slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('glossary content', () => {
  it('defines every term at a usable length', () => {
    for (const term of ALL_TERMS) {
      // Short enough and it is a label, not a definition; an answer engine has
      // nothing to lift.
      expect(term.definition.length, `${term.slug} is too short to be a definition`).toBeGreaterThan(
        80,
      );
    }
  });

  it('ends every definition as a sentence', () => {
    for (const term of ALL_TERMS) {
      expect(term.definition.trim(), `${term.slug} does not end in a full stop`).toMatch(/[.!?]$/);
    }
  });

  it('names every term', () => {
    for (const term of ALL_TERMS) expect(term.term.trim().length).toBeGreaterThan(0);
  });
});

describe('glossary cross-links', () => {
  it('only points at articles that are actually published', () => {
    // A typo here renders a link to a 404 in the middle of a definition.
    for (const term of ALL_TERMS) {
      for (const slug of term.seeAlso ?? []) {
        expect(PUBLISHED.has(slug), `${term.slug} references unknown article "${slug}"`).toBe(true);
      }
    }
  });

  it('does not list the same article twice under one term', () => {
    for (const term of ALL_TERMS) {
      const refs = term.seeAlso ?? [];
      expect(new Set(refs).size, `${term.slug} repeats an article`).toBe(refs.length);
    }
  });

  it('connects most terms to at least one article', () => {
    // The glossary earns its place by linking to the corpus. A few orphans are
    // fine; a majority of them means it has drifted away from the reporting.
    const linked = ALL_TERMS.filter((t) => (t.seeAlso ?? []).length > 0);
    expect(linked.length).toBeGreaterThan(ALL_TERMS.length / 2);
  });

  it('reaches every published article from somewhere in the glossary', () => {
    const reached = new Set(ALL_TERMS.flatMap((t) => t.seeAlso ?? []));
    for (const slug of PUBLISHED) {
      expect(reached.has(slug), `no glossary term links to ${slug}`).toBe(true);
    }
  });
});
