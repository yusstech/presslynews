import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@pressly/types';
import { Container, Meta, SectionLabel } from '@pressly/ui';
import { Link } from '@/i18n/navigation';
import { GLOSSARY, ALL_TERMS } from '@/content/glossary';
import { getAllPublished } from '@/lib/content-api';
import { englishCanonical, glossaryJsonLd } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'glossary' });
  return {
    title: t('title'),
    description: t('description'),
    // The definitions are English in every locale, so the four URLs are
    // duplicates rather than language variants — see lib/seo.ts.
    ...englishCanonical('/glossary'),
  };
}

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('glossary');

  // Headlines are resolved from the database rather than stored beside the
  // terms, so a retitled or unpublished article cannot leave a stale label —
  // or a dead link — behind in the glossary.
  const published = await getAllPublished(500);
  const headlines = new Map(published.map((a) => [a.slug, a.headline]));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            glossaryJsonLd(ALL_TERMS, { name: t('title'), description: t('description') }),
          ),
        }}
      />

      <Container className="py-16">
        <div className="mx-auto max-w-reading">
          <h1 className="animate-rise font-serif text-h1 font-semibold text-ink">{t('title')}</h1>
          <div
            className="animate-rise stagger mt-6 space-y-3"
            style={{ '--stagger': 1 } as never}
          >
            <p className="font-sans text-body text-ink-muted">{t('intro')}</p>
            {/* Said plainly rather than left for the reader to discover: the
                chrome around this page is translated and the definitions are
                not. */}
            <Meta>{t('languageNote')}</Meta>
          </div>

          {/* Everything below is English, so it is laid out as English even
              when the chrome around it is Arabic — the same treatment the
              article page gives an English story inside RTL chrome.
              Without this, bidi reorders the term index into reverse reading
              order and throws the full stop to the wrong end of every blurb. */}
          <div dir="ltr">
            {/* The index. Forty-five terms is past the point where scrolling to
                find one is reasonable, and it doubles as the internal-link
                surface that gives every anchor a path in from the top. */}
            <nav
              id="contents"
              aria-label={t('contents')}
              className="animate-rise stagger mt-12 scroll-mt-24 rounded-lg border border-border bg-surface/40 p-6"
              style={{ '--stagger': 2 } as never}
            >
              <SectionLabel as="h2">{t('contents')}</SectionLabel>
              <ul className="space-y-5">
                {GLOSSARY.map((section) => (
                  <li key={section.slug}>
                    <a
                      href={`#${section.slug}`}
                      className="-mx-1 inline-block px-1 py-1 font-sans text-ui-sm font-medium text-ink underline decoration-border underline-offset-4 transition-colors duration-fast ease-editorial hover:decoration-ink"
                    >
                      {section.title}
                    </a>
                    <ul className="mt-1.5 flex flex-wrap gap-x-1 gap-y-0.5">
                      {section.terms.map((term, i) => (
                        <li key={term.slug}>
                          <a
                            href={`#${term.slug}`}
                            className="-mx-1 inline-block px-1 py-1 font-sans text-ui-sm text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink"
                          >
                            {term.term}
                            {/* Separates terms, so the last one does not get a
                                trailing dot with nothing after it. */}
                            {i < section.terms.length - 1 && (
                              <span aria-hidden="true" className="ps-1 text-border">
                                ·
                              </span>
                            )}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </nav>

            {GLOSSARY.map((section, i) => (
              <section
                key={section.slug}
                id={section.slug}
                // Anchored headings land under the sticky header without it.
                className="animate-rise stagger mt-16 scroll-mt-24"
                style={{ '--stagger': 3 + i } as never}
              >
                <h2 className="font-serif text-h3 font-semibold text-ink">{section.title}</h2>
                <p className="mt-2 font-sans text-ui-sm text-ink-muted">{section.blurb}</p>

                <dl className="mt-8 space-y-10">
                  {section.terms.map((term) => (
                    <div key={term.slug} id={term.slug} className="scroll-mt-24">
                      <dt className="font-serif text-h4 font-semibold text-ink">
                        {term.term}
                        {term.also && (
                          <span className="ms-2 font-sans text-ui-sm font-normal text-ink-muted">
                            {t('alsoKnown')}: {term.also}
                          </span>
                        )}
                      </dt>
                      <dd className="mt-2 font-sans text-body text-ink-muted">
                        {term.definition}
                        {term.seeAlso && (
                          <SeeAlso
                            label={t('appearsIn')}
                            slugs={term.seeAlso}
                            headlines={headlines}
                          />
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-10">
                  {/* Padding, not bare text: a caption-sized link is a 17px-tall
                      line box, under the 24px minimum touch target. */}
                  <a
                    href="#contents"
                    className="-mx-1.5 inline-block px-1.5 py-1 font-mono text-caption text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink"
                  >
                    {t('backToContents')}
                  </a>
                </p>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}

/**
 * The articles a term appears in.
 *
 * Silently drops a slug with no published article behind it. A glossary entry
 * outliving the story it was written for is a normal thing to happen; a 404 in
 * the middle of a definition is not.
 */
function SeeAlso({
  label,
  slugs,
  headlines,
}: {
  label: string;
  slugs: string[];
  headlines: Map<string, string>;
}) {
  const live = slugs.filter((slug) => headlines.has(slug));
  if (live.length === 0) return null;

  return (
    <span className="mt-3 block">
      <span className="font-mono text-meta font-medium uppercase text-ink-muted">{label}</span>
      {/* The vertical padding is the row spacing *and* what lifts each link to
          the 24px minimum target — a bare block link is only its line box. */}
      <span className="mt-0.5 block">
        {live.map((slug) => (
          <Link
            key={slug}
            href={`/article/${slug}`}
            className="-mx-1 block px-1 py-1 font-sans text-ui-sm text-ink-muted underline decoration-border underline-offset-4 transition-colors duration-fast ease-editorial hover:text-ink hover:decoration-ink"
          >
            {headlines.get(slug)}
          </Link>
        ))}
      </span>
    </span>
  );
}
