import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@pressly/types';
import { Container } from '@pressly/ui';
import { ArticleCard } from '@/components/article-card';
import { EmptyState } from '@/components/empty-state';
import { getByTopic, getTopic } from '@/lib/content-api';
import { localizedMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import type { Locale } from '@pressly/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const topic = await getTopic(slug);
  if (!topic || !isLocale(locale)) return {};
  return {
    title: topic.name,
    description: `${topic.name} coverage from Pressly — reporting and project records.`,
    ...localizedMetadata(locale as Locale, `/topic/${slug}`),
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const topic = await getTopic(slug);
  if (!topic) notFound();
  const [articles, t] = await Promise.all([getByTopic(slug), getTranslations('empty')]);

  return (
    <Container className="py-12">
      <header className="animate-rise mb-10 border-b border-border pb-6">
        <h1 className="font-serif text-4xl font-semibold text-ink">{topic.name}</h1>
      </header>
      {articles.length === 0 ? (
        <EmptyState
          title={t('title')}
          body={t('topic', { topic: topic.name })}
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
