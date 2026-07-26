import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { isLocale } from '@pressly/types';
import { Button, Chip, Container, Input, Kicker, Meta, SectionLabel } from '@pressly/ui';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArticleCard } from '@/components/article-card';
import { EmptyState } from '@/components/empty-state';
import { getHome, getTopics } from '@/lib/content-api';
import { localizedMetadata } from '@/lib/seo';
import { SIZES } from '@/lib/images';
import { MediaImage } from '@/components/media-image';
import type { Metadata } from 'next';
import type { Locale } from '@pressly/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    // The layout template appends "· Pressly"; on the home page that would
    // read "Pressly · Pressly".
    title: { absolute: 'Pressly — Global news & infrastructure intelligence' },
    description:
      'Reporting and primary-source project records from the energy and infrastructure sector across the Middle East, Africa and Europe.',
    ...localizedMetadata(locale as Locale, '/'),
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [home, topics, t, ta] = await Promise.all([
    getHome(),
    getTopics(),
    getTranslations('home'),
    getTranslations('article'),
  ]);

  if (!home.hero) return <EmptyHome />;
  const hero = home.hero;
  const isArabicHero = hero.primaryLanguage === 'ar';

  return (
    <Container className="py-8 sm:py-12">
      {home.breaking.length > 0 && (
        <div className="animate-rise mb-8 flex items-center gap-3 overflow-x-auto border-b border-border pb-4">
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 font-mono text-meta font-medium uppercase tracking-widest text-background">
            {t('breaking')}
          </span>
          <div className="flex items-center gap-6">
            {home.breaking.map((a) => (
              <Link
                key={a.id}
                href={`/article/${a.slug}`}
                className="shrink-0 py-1 font-sans text-ui-sm text-ink transition-colors duration-fast ease-editorial hover:text-accent"
              >
                {a.headline}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* The hero used to be a 50/50 split, which left the text column mostly
          empty at wide viewports — a headline and one line of standfirst
          floating in half a screen. Giving the image the larger share and
          capping the text measure keeps the pairing balanced as the viewport
          grows, instead of stretching the gap. */}
      <section className="animate-rise stagger" style={{ '--stagger': 1 } as CSSProperties}>
        <Link
          href={`/article/${hero.slug}`}
          className="group grid gap-8 md:grid-cols-[3fr,2fr] md:items-center lg:gap-12"
        >
          <div className="overflow-hidden rounded-xl ring-1 ring-border transition-[box-shadow,transform] duration-base ease-editorial group-hover:-translate-y-1 group-hover:shadow-raised group-hover:ring-ink/25">
            {hero.heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              // The hero is the LCP element on this page — `priority` makes it
              // eager and high-priority; everything else stays lazy.
              <MediaImage
                variants={hero.heroImage.variants}
                src={hero.heroImage.variants.large ?? hero.heroImage.variants.original}
                sizes={SIZES.homeHero}
                alt={hero.heroImage.alt ?? ''}
                priority
                className="aspect-[16/10] w-full object-cover transition-transform duration-slow ease-editorial group-hover:scale-[1.03]"
              />
            ) : (
              <div
                className="aspect-[16/10] w-full bg-gradient-to-br from-border/70 to-border transition-colors duration-base ease-editorial group-hover:to-ink/15"
                aria-hidden
              />
            )}
          </div>
          <div className="max-w-xl">
            <Kicker className="group-hover:text-accent">
              {hero.country?.name} · {hero.topic?.name}
            </Kicker>
            <h1
              className={`mt-3 font-serif text-h1 font-semibold text-ink transition-colors duration-fast ease-editorial decoration-accent/50 underline-offset-4 group-hover:underline lg:text-display ${
                isArabicHero ? 'font-arabic' : ''
              }`}
            >
              {hero.headline}
            </h1>
            {hero.subheadline && (
              <p className={`mt-4 font-sans text-lede text-ink-muted ${isArabicHero ? 'font-arabic' : ''}`}>
                {hero.subheadline}
              </p>
            )}
            <Meta className="mt-6 block">{ta('readingTime', { minutes: hero.readingTime })}</Meta>
          </div>
        </Link>
      </section>

      <section className="animate-rise stagger mt-12" style={{ '--stagger': 2 } as CSSProperties}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip href="#latest" active>
            {t('trending')}
          </Chip>
          {topics.map((topic) => (
            <Chip key={topic.id} href={`/topic/${topic.slug}`}>
              {topic.name}
            </Chip>
          ))}
        </div>
      </section>

      {home.latest.length > 0 && (
        <section id="latest" className="mt-10">
          <SectionHeading>{t('latest')}</SectionHeading>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {home.latest.map((a, i) => (
              <ArticleCard key={a.id} article={a} locale={locale} index={i} />
            ))}
          </div>
        </section>
      )}

      {home.editorsPicks.length > 0 && (
        <section className="mt-16">
          <SectionHeading>{t('editorsPicks')}</SectionHeading>
          <div className="divide-y divide-border">
            {home.editorsPicks.map((a, i) => (
              <ArticleCard key={a.id} article={a} locale={locale} variant="row" index={i} />
            ))}
          </div>
        </section>
      )}

      <section className="animate-rise mt-20 rounded-2xl border border-border bg-surface p-8 text-center sm:p-12">
        <h2 className="font-serif text-h2 font-semibold text-ink">{t('newsletterTitle')}</h2>
        <p className="mx-auto mt-3 max-w-md font-sans text-body text-ink-muted">
          {t('newsletterBody')}
        </p>
        <form className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            required
            placeholder="you@example.com"
            aria-label={t('newsletterCta')}
            // `flex-1` sets flex-basis 0 along the main axis — in the stacked
            // mobile layout that is the HEIGHT, which collapsed the field to
            // 21px. Only stretch it once the form is a row.
            className="sm:flex-1"
          />
          <Button type="submit" className="shrink-0">
            {t('newsletterCta')}
          </Button>
        </form>
      </section>
    </Container>
  );
}

async function EmptyHome() {
  const t = await getTranslations('empty');
  return (
    <EmptyState
      standalone
      title={t('homeTitle')}
      body={t('homeBody')}
      action={{ label: t('openNewsroom'), href: '/newsroom' }}
    />
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="animate-rise">{children}</SectionLabel>;
}
