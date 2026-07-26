import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@pressly/types';
import { Container, Kicker } from '@pressly/ui';
import { ArticleCard } from '@/components/article-card';
import { EmptyState } from '@/components/empty-state';
import { getByCountry, getCountry } from '@/lib/content-api';

export default async function CountryPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const country = await getCountry(code);
  if (!country) notFound();
  const [articles, t] = await Promise.all([getByCountry(code), getTranslations('empty')]);

  return (
    <Container className="py-12">
      <header className="animate-rise mb-10 border-b border-border pb-6">
        <Kicker>{country.region}</Kicker>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">{country.name}</h1>
      </header>
      {articles.length === 0 ? (
        <EmptyState
          title={t('title')}
          body={t('country', { country: country.name })}
          action={{ label: t('browseLatest'), href: '/' }}
        />
      ) : (
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <ArticleCard key={a.id} article={a} locale={locale} headingLevel={2} index={i} />
          ))}
        </div>
      )}
    </Container>
  );
}
