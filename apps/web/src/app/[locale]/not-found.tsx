import { useTranslations } from 'next-intl';
import { Container } from '@pressly/ui';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('article');
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-ink-muted">404</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-ink">Page not found</h1>
      <Link href="/" className="mt-6 inline-block py-1 font-sans text-ui-sm text-accent hover:underline">
        ← {t('backToHome')}
      </Link>
    </Container>
  );
}
