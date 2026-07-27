import { describe, expect, it } from 'vitest';
import { buildArticleUpdate, readingTimeFor, slugify } from '@/lib/newsroom-select';

/** Narrow the union so a test can read the field it cares about. */
function ok(result: ReturnType<typeof buildArticleUpdate>) {
  if ('error' in result) throw new Error(`expected success, got: ${result.error}`);
  return result.data as Record<string, unknown>;
}
function err(result: ReturnType<typeof buildArticleUpdate>) {
  if (!('error' in result)) throw new Error('expected a validation error, got success');
  return result.error;
}

describe('buildArticleUpdate', () => {
  it('ignores keys outside the editable set', () => {
    // Status changes have consequences — timestamps, cache invalidation — and
    // belong on the transition route, not in an autosave body.
    expect(ok(buildArticleUpdate({ status: 'PUBLISHED', slug: 'hijacked' }))).toEqual({});
  });

  it('accepts a plain field edit', () => {
    expect(ok(buildArticleUpdate({ headline: 'A new headline' }))).toEqual({
      headline: 'A new headline',
    });
  });

  it('allows null to clear an optional field', () => {
    expect(ok(buildArticleUpdate({ subheadline: null }))).toEqual({ subheadline: null });
  });

  it.each([
    ['articleType', 'NONSENSE'],
    ['primaryLanguage', 'xx'],
  ])('rejects an out-of-range %s', (field, value) => {
    expect(err(buildArticleUpdate({ [field]: value }))).toContain(field);
  });

  it('accepts every valid articleType', () => {
    for (const t of ['NEWS', 'ANALYSIS', 'OPINION', 'FEATURE', 'INTERVIEW', 'BRIEFING']) {
      expect(ok(buildArticleUpdate({ articleType: t }))).toEqual({ articleType: t });
    }
  });

  it('rejects a non-boolean isBreaking rather than coercing it', () => {
    // "false" is truthy. Coercion here would silently mark a story as breaking.
    expect(err(buildArticleUpdate({ isBreaking: 'false' }))).toContain('isBreaking');
  });

  it('rejects a number where a string belongs', () => {
    expect(err(buildArticleUpdate({ headline: 12345 }))).toContain('headline');
  });

  it('rejects a bodyJson that is not a document', () => {
    expect(err(buildArticleUpdate({ bodyJson: 'a string' }))).toContain('bodyJson');
  });

  it('recomputes readingTime whenever the body changes', () => {
    const data = ok(buildArticleUpdate({ bodyJson: { type: 'doc', content: [] } }));
    expect(data.readingTime).toBeTypeOf('number');
  });

  describe('publishAt', () => {
    it('parses an ISO string into a Date', () => {
      const data = ok(buildArticleUpdate({ publishAt: '2026-03-14T09:30:00Z' }));
      expect(data.publishAt).toBeInstanceOf(Date);
      expect((data.publishAt as Date).toISOString()).toBe('2026-03-14T09:30:00.000Z');
    });

    it.each([null, ''])('treats %o as clearing the date', (value) => {
      expect(ok(buildArticleUpdate({ publishAt: value }))).toEqual({ publishAt: null });
    });

    it('rejects an unparseable date instead of storing Invalid Date', () => {
      // Prisma would reject this far from here, with a message that never
      // mentions publishAt.
      expect(err(buildArticleUpdate({ publishAt: 'not-a-date' }))).toContain('publishAt');
    });
  });
});

describe('slugify', () => {
  it('produces a URL-safe slug with a disambiguating suffix', () => {
    expect(slugify('Samaya Group Completes the Tabuk Line')).toMatch(
      /^samaya-group-completes-the-tabuk-line-[a-z0-9]{6}$/,
    );
  });

  it('gives two drafts sharing a headline different slugs', () => {
    // They collide on the unique index otherwise.
    expect(slugify('Untitled')).not.toBe(slugify('Untitled'));
  });

  it('still returns something usable for a headline with no letters', () => {
    expect(slugify('!!! ???')).toMatch(/^story-[a-z0-9]{6}$/);
  });

  it('reduces accented letters to their base rather than splitting the word', () => {
    // NFKD decomposition left the combining accent behind as a separator, so
    // this produced "re-seau-e-lectrique". The site launches in French and
    // German; accented headlines are the normal case, not an edge one.
    expect(slugify('Réseau électrique')).toMatch(/^reseau-electrique-/);
    expect(slugify('Übertragungsnetz')).toMatch(/^ubertragungsnetz-/);
  });

  it('drops apostrophes rather than treating them as word breaks', () => {
    // Otherwise "Nigeria's Grid" slugs to "nigeria-s-grid", which reads as a
    // typo in a URL and splits the word for a search engine.
    expect(slugify("Nigeria's Grid")).toMatch(/^nigerias-grid-/);
    expect(slugify('Nigeria’s Grid')).toMatch(/^nigerias-grid-/);
  });

  it('keeps non-Latin scripts instead of reducing them to a bare suffix', () => {
    expect(slugify('شبكة الكهرباء')).toMatch(/^شبكة-الكهرباء-/);
  });
});

describe('readingTimeFor', () => {
  it('never returns zero for a story with any words in it', () => {
    expect(readingTimeFor({ type: 'doc', content: [{ text: 'one two three' }] })).toBeGreaterThan(0);
  });

  it('survives an empty or missing body', () => {
    expect(readingTimeFor(undefined)).toBeGreaterThan(0);
    expect(readingTimeFor({})).toBeGreaterThan(0);
  });

  it('scales with length', () => {
    const short = readingTimeFor({ text: 'word '.repeat(50) });
    const long = readingTimeFor({ text: 'word '.repeat(2000) });
    expect(long).toBeGreaterThan(short);
  });
});
