import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import type { ArticleCard as ArticleCardData, Locale } from '@pressly/types';
import { cn, Kicker, Meta } from '@pressly/ui';
import { Link } from '@/i18n/navigation';
import { SIZES } from '@/lib/images';
import { MediaImage } from './media-image';

interface Props {
  article: ArticleCardData;
  locale: Locale;
  /** 'default' vertical card, or 'row' for compact list rows. */
  variant?: 'default' | 'row';
  /**
   * Heading level for the card's headline. Defaults to 3, which suits the home
   * page where cards sit under an h2 section heading. Pages that list cards
   * directly under their h1 pass 2 so the outline never skips a level.
   */
  headingLevel?: 2 | 3;
  priority?: boolean;
  /**
   * Position in its list. Staggers the entrance animation so a grid arrives in
   * reading order rather than all at once. Omit for cards that stand alone.
   */
  index?: number;
}

/** Minimal card — image, category, headline, reading time. Nothing extra. */
export function ArticleCard({
  article,
  variant = 'default',
  headingLevel = 3,
  index,
}: Props) {
  const t = useTranslations('article');
  const Heading = `h${headingLevel}` as 'h2' | 'h3';
  const src = article.heroImage?.variants.tablet ?? article.heroImage?.variants.large;
  const isArabic = article.primaryLanguage === 'ar';
  const entrance =
    index === undefined
      ? undefined
      : { className: 'animate-rise stagger', style: { '--stagger': index } as CSSProperties };

  if (variant === 'row') {
    return (
      <Link
        href={`/article/${article.slug}`}
        className={cn('group flex gap-4 py-4 first:pt-0', entrance?.className)}
        style={entrance?.style}
      >
        {src && (
          <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md">
            <MediaImage
              variants={article.heroImage?.variants}
              src={article.heroImage?.variants.thumb ?? src}
              sizes={SIZES.rowThumb}
              alt={article.heroImage?.alt ?? ''}
              className="h-full w-full object-cover transition-transform duration-slow ease-editorial group-hover:scale-[1.03]"
            />
          </div>
        )}
        <div className="min-w-0">
          <Kicker className="group-hover:text-accent">
            {article.country?.name} · {article.topic?.name}
          </Kicker>
          <Heading
            className={cn(
              'mt-1 font-serif text-h4 font-medium text-ink transition-colors duration-fast ease-editorial',
              // Navy-on-black is a 1.19:1 shift — invisible. The underline is
              // what a reader actually perceives.
              'decoration-accent/50 underline-offset-4 group-hover:underline',
              isArabic && 'font-arabic',
            )}
          >
            {article.headline}
          </Heading>
          <Meta className="mt-1 block">{t('readingTime', { minutes: article.readingTime })}</Meta>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/article/${article.slug}`}
      className={cn('group flex flex-col', entrance?.className)}
      style={entrance?.style}
    >
      {/* The media frame carries the hover, and it exists whether or not there
          is an image — an imageless story must still respond to the pointer.
          A ring plus a lift reads at a glance; the 2% zoom on its own does not,
          least of all on a flat placeholder. */}
      <div
        className={cn(
          'relative overflow-hidden rounded-lg ring-1 ring-border',
          // Tailwind composes `ring-*` and `shadow-*` into one box-shadow, so
          // transitioning box-shadow animates both the ring and the elevation.
          'transition-[box-shadow,transform] duration-base ease-editorial',
          'group-hover:-translate-y-1 group-hover:shadow-raised group-hover:ring-ink/25',
        )}
      >
        {src ? (
           
          <MediaImage
            variants={article.heroImage?.variants}
            src={src}
            sizes={SIZES.card}
            alt={article.heroImage?.alt ?? ''}
            className="aspect-[3/2] w-full object-cover transition-transform duration-slow ease-editorial group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="aspect-[3/2] w-full bg-gradient-to-br from-border/70 to-border transition-colors duration-base ease-editorial group-hover:from-border group-hover:to-ink/15"
            aria-hidden
          />
        )}
      </div>
      <div className="mt-4">
        <Kicker className="group-hover:text-accent">
          {article.country?.name} · {article.topic?.name}
        </Kicker>
        <Heading
          className={cn(
            'mt-2 font-serif text-h3 font-semibold text-ink transition-colors duration-fast ease-editorial',
            'decoration-accent/50 underline-offset-4 group-hover:underline',
            isArabic && 'font-arabic',
          )}
        >
          {article.headline}
        </Heading>
        {article.summary && (
          <p className={cn('mt-2 line-clamp-2 font-sans text-ui-sm text-ink-muted', isArabic && 'font-arabic')}>
            {article.summary}
          </p>
        )}
        <Meta className="mt-3 block">{t('readingTime', { minutes: article.readingTime })}</Meta>
      </div>
    </Link>
  );
}
