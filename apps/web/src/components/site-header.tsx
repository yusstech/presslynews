import { useTranslations } from 'next-intl';
import { Container } from '@pressly/ui';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { SearchTrigger } from './search-trigger';

/**
 * Minimal header — "navigation should feel invisible." Logo, a search entry
 * point, and the language switcher. Sections live one scroll away, not in a
 * mega-menu.
 */
export function SiteHeader() {
  const t = useTranslations('nav');
  const sections = ['world', 'business', 'energy', 'technology', 'culture'] as const;

  const sectionLinkClass =
    '-mx-1.5 shrink-0 px-1.5 py-2 font-sans text-ui-sm text-ink-muted ' +
    'transition-colors duration-fast ease-editorial hover:text-ink';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          {/* Vertical padding here is a hit-area, not a spacing, decision: a
              text link's box is only its line height (~17px), well under the
              24px minimum target size (WCAG 2.5.8). The header is a fixed
              h-16, so this costs no layout. */}
          <Link
            href="/"
            className="py-2 font-serif text-xl font-semibold tracking-tight text-ink"
            aria-label="Pressly home"
          >
            Pressly
          </Link>
          {/* Wide screens: sections sit inline beside the wordmark. */}
          <nav className="hidden items-center gap-6 md:flex" aria-label={t('sections')}>
            {sections.map((s) => (
              <Link key={s} href={`/topic/${s}`} className={sectionLinkClass}>
                {t(s)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <SearchTrigger />
          <LanguageSwitcher />
        </div>
      </Container>

      {/* Narrow screens: the same sections on their own scrollable row.
          They used to be `hidden md:flex` with nothing in their place, so on
          every phone the Reader had no section navigation at all. A scroll
          strip keeps each section one tap away — a drawer would put them two
          taps away behind a button, and the brief asks for navigation that
          feels invisible. */}
      <nav className="md:hidden" aria-label={t('sections')}>
        <Container className="scrollbar-none flex items-center gap-5 overflow-x-auto pb-2.5">
          {sections.map((s) => (
            <Link key={s} href={`/topic/${s}`} className={sectionLinkClass}>
              {t(s)}
            </Link>
          ))}
        </Container>
      </nav>
    </header>
  );
}
