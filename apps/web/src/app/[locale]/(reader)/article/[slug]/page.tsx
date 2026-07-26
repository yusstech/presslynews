import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@pressly/types';
import { ArticleBody } from '@pressly/article-renderer';
import { Container, Kicker, Meta } from '@pressly/ui';
import { Link } from '@/i18n/navigation';
import { ArticleCard } from '@/components/article-card';
import { ReadingProgress } from '@/components/reading-progress';
import { getArticle, getByTopic } from '@/lib/content-api';
import { SIZES } from '@/lib/images';
import { MediaImage } from '@/components/media-image';
import { formatDate } from '@/lib/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};
  return {
    title: article.seoTitle ?? article.headline,
    description: article.metaDescription ?? article.summary,
    openGraph: {
      title: article.headline,
      description: article.summary,
      // Prefer the card the worker renders on publish; fall back to the hero.
      images:
        article.socialImageUrl ??
        (article.heroImage ? [article.heroImage.variants.original] : undefined),
      type: 'article',
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const article = await getArticle(slug);
  if (!article) notFound();

  const t = await getTranslations('article');
  const related = (article.topic ? await getByTopic(article.topic.slug) : [])
    .filter((a) => a.id !== article.id)
    .slice(0, 3);
  const isArabic = article.primaryLanguage === 'ar';
  const contentDir = isArabic ? 'rtl' : 'ltr';

  return (
    <>
      <ReadingProgress />
      <article className="pb-16">
        <Container className="pt-10">
          <div className="animate-rise mx-auto max-w-reading" dir={contentDir}>
            {article.isBreaking && (
              <span className="mb-4 inline-block rounded-full bg-accent px-2.5 py-1 font-mono text-meta font-medium uppercase tracking-widest text-background">
                {t('breaking')}
              </span>
            )}
            <Kicker>
              {article.country?.name} · {article.topic?.name}
            </Kicker>
            <h1
              className={`mt-3 font-serif text-4xl font-semibold leading-[1.12] text-ink sm:text-[2.75rem] ${
                isArabic ? 'font-arabic' : ''
              }`}
            >
              {article.headline}
            </h1>
            {article.subheadline && (
              <p className={`mt-4 font-sans text-lede text-ink-muted ${isArabic ? 'font-arabic' : ''}`}>
                {article.subheadline}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-6">
              {article.author && (
                <span className="font-sans text-sm text-ink">
                  {t('by', { author: article.author.name })}
                </span>
              )}
              <Meta>{formatDate(article.publishedAt, locale)}</Meta>
              <Meta>· {t('readingTime', { minutes: article.readingTime })}</Meta>
            </div>
          </div>
        </Container>

        {article.heroImage && (
          <Container className="animate-rise stagger mt-8" style={{ '--stagger': 1 } as CSSProperties}>
            {/* Was serving `original` — the untouched upload — to every reader
                on every device. It is also the LCP element here. */}
            <MediaImage
              variants={article.heroImage.variants}
              src={article.heroImage.variants.large ?? article.heroImage.variants.original}
              sizes={SIZES.articleHero}
              alt={article.heroImage.alt ?? ''}
              priority
              className="mx-auto max-h-[560px] w-full max-w-content rounded-xl object-cover"
            />
          </Container>
        )}

        {article.summary && (
          <Container className="animate-rise stagger mt-10" style={{ '--stagger': 2 } as CSSProperties}>
            <div className="mx-auto max-w-reading" dir={contentDir}>
              <p
                className={`border-s-2 border-accent ps-5 font-serif text-xl leading-relaxed text-ink ${
                  isArabic ? 'font-arabic' : ''
                }`}
              >
                {article.summary}
              </p>
            </div>
          </Container>
        )}

        <Container className="animate-rise stagger mt-8" style={{ '--stagger': 3 } as CSSProperties}>
          <div className={`mx-auto max-w-reading ${isArabic ? 'font-arabic' : ''}`} dir={contentDir}>
            <ArticleBody doc={article.body} />
          </div>
        </Container>

        {related.length > 0 && (
          <Container className="mt-16">
            <div className="mx-auto max-w-reading">
              <h2 className="mb-6 font-mono text-xs font-medium uppercase tracking-widest text-ink-muted">
                {t('related')}
              </h2>
              <div className="divide-y divide-border">
                {related.map((a, i) => (
                  <ArticleCard key={a.id} article={a} locale={locale} variant="row" index={i} />
                ))}
              </div>
              <div className="mt-10">
                <Link href="/" className="inline-block py-1 font-sans text-ui-sm text-accent hover:underline">
                  ← {t('backToHome')}
                </Link>
              </div>
            </div>
          </Container>
        )}
      </article>
    </>
  );
}
