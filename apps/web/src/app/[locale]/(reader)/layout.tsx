import { getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/** Reader chrome — the calm public experience. */
export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('a11y');

  return (
    <div className="flex min-h-screen flex-col">
      {/* Lets keyboard users bypass the header on every page (WCAG 2.4.1). */}
      <a href="#main" className="skip-link">
        {t('skipToContent')}
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
