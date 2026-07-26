import { useTranslations } from 'next-intl';
import { Container } from '@pressly/ui';
import { Link } from '@/i18n/navigation';

const SECTIONS = ['world', 'business', 'energy', 'technology', 'culture'] as const;

/**
 * The footer is where a reader who has finished a story decides what to do
 * next, so it carries real navigation rather than three links and whitespace.
 * Everything here points at a route that exists — the About / Editorial /
 * Contact links used to 404 on every page of the site.
 */
export function SiteFooter() {
  const t = useTranslations('footer');
  const tn = useTranslations('nav');
  const tb = useTranslations('brand');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-border bg-surface/40">
      <Container className="grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:pe-8">
          <Link href="/" className="inline-block py-1 font-serif text-h4 font-semibold text-ink">
            {tb('name')}
          </Link>
          <p className="mt-2 max-w-xs font-sans text-ui-sm leading-relaxed text-ink-muted">
            {tb('tagline')}
          </p>
        </div>

        <FooterColumn title={t('sections')}>
          {SECTIONS.map((s) => (
            <FooterLink key={s} href={`/topic/${s}`}>
              {tn(s)}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title={t('organisation')}>
          <FooterLink href="/about">{t('about')}</FooterLink>
          <FooterLink href="/editorial-standards">{t('editorial')}</FooterLink>
          <FooterLink href="/contact">{t('contact')}</FooterLink>
        </FooterColumn>

        <FooterColumn title={t('follow')}>
          <FooterLink href="/search">{tn('search')}</FooterLink>
          {/* Not a locale-prefixed route — this is the raw feed. */}
          <li>
            <a
              href="/feed.xml"
              className="-mx-1.5 inline-block px-1.5 py-1 font-sans text-ui-sm text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink"
            >
              {t('rss')}
            </a>
          </li>
        </FooterColumn>
      </Container>

      <Container className="border-t border-border py-6">
        <p className="font-mono text-caption text-ink-muted">{t('rights', { year })}</p>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-mono text-meta font-medium uppercase text-ink-muted">{title}</h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      {/* `inline-block` + padding so the target reaches the 24px minimum — a
          bare inline link is only its line box. The horizontal padding matters
          for Arabic, where a short word like "بحث" is under 24px wide; the
          negative margin keeps the column visually flush. */}
      <Link
        href={href}
        className="-mx-1.5 inline-block px-1.5 py-1 font-sans text-ui-sm text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink"
      >
        {children}
      </Link>
    </li>
  );
}
