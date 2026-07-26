'use client';

import { Button, Container } from '@pressly/ui';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from './auth-context';

export function NewsroomHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  if (pathname === '/newsroom/login') return null;

  return (
    <header className="border-b border-border bg-surface">
      <Container className="flex h-14 items-center justify-between">
        <Link href="/newsroom" className="flex items-baseline gap-2">
          <span className="font-serif text-lg font-semibold text-ink">Pressly</span>
          <span className="font-mono text-meta uppercase tracking-widest text-ink-muted">
            Newsroom
          </span>
        </Link>
        {user && (
          <div className="flex items-center gap-4">
            <span className="hidden font-sans text-sm text-ink sm:inline">{user.name}</span>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-meta uppercase tracking-wide text-ink-muted">
              {user.role.replace('_', ' ')}
            </span>
            <Button variant="plain" size="sm" onClick={logout} className="text-ink-muted">
              Sign out
            </Button>
          </div>
        )}
      </Container>
    </header>
  );
}
