'use client';

import { useEffect } from 'react';
import { Container } from '@pressly/ui';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from './auth-context';

/** Gate for authenticated Newsroom pages. Redirects to login when signed out. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/newsroom/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <Container className="py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Loading…</p>
      </Container>
    );
  }
  return <>{children}</>;
}
