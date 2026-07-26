'use client';

import { useTranslations } from 'next-intl';
import { AuthProvider } from '@/newsroom/auth-context';
import { NewsroomHeader } from '@/newsroom/newsroom-header';

/** Newsroom chrome — a focused, tool-like shell, distinct from the Reader. */
export default function NewsroomLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('a11y');

  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <a href="#main" className="skip-link">
          {t('skipToContent')}
        </a>
        <NewsroomHeader />
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
