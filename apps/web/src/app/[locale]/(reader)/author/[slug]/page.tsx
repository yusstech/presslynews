import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@pressly/types';
import { Container } from '@pressly/ui';
import { ArticleCard } from '@/components/article-card';
import { authors, getAllArticles, toCard } from '@/data/seed';

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const author = Object.values(authors).find((a) => a.slug === slug);
  if (!author) notFound();
  const articles = getAllArticles()
    .filter((a) => a.author?.id === author.id)
    .map(toCard);

  return (
    <Container className="py-12">
      <header className="mb-10 border-b border-border pb-6">
        <h1 className="font-serif text-h1 font-semibold text-ink">{author.name}</h1>
      </header>
      <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} locale={locale} />
        ))}
      </div>
    </Container>
  );
}
