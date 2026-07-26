import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@pressly/types';
import { Container, Kicker, Meta } from '@pressly/ui';
import { Link } from '@/i18n/navigation';
import { EmptyState } from '@/components/empty-state';
import { searchContent } from '@/lib/content-api';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const { q = '' } = await searchParams;
  const t = await getTranslations('search');
  const ta = await getTranslations('article');
  const results = q.trim() ? await searchContent(q) : [];

  return (
    <Container className="py-12">
      <header className="animate-rise mb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">{t('results')}</p>
        {q && <h1 className="mt-2 font-serif text-3xl font-semibold text-ink">“{q}”</h1>}
      </header>

      {q.trim() && results.length === 0 ? (
        <EmptyState title={t('noResultsTitle')} body={t('noResultsBody')} />
      ) : (
        <div className="mx-auto max-w-reading divide-y divide-border">
          {results.map((r, i) => {
            const isArabic = r.language === 'ar';
            return (
              <Link
                key={r.id}
                href={`/article/${r.slug}`}
                className="animate-rise stagger group block py-5"
                style={{ '--stagger': i } as CSSProperties}
              >
                <Kicker>
                  {[r.countryName, r.topicName].filter(Boolean).join(' · ')}
                </Kicker>
                <h2
                  className={`mt-1 font-serif text-xl font-medium text-ink transition-colors group-hover:text-accent ${
                    isArabic ? 'font-arabic' : ''
                  }`}
                >
                  {r.headline}
                </h2>
                {r.summary && (
                  <p className={`mt-1 line-clamp-2 font-sans text-sm text-ink-muted ${isArabic ? 'font-arabic' : ''}`}>
                    {r.summary}
                  </p>
                )}
                <Meta className="mt-2 block">{ta('readingTime', { minutes: r.readingTime })}</Meta>
              </Link>
            );
          })}
        </div>
      )}
    </Container>
  );
}
