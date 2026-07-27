'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Container, Field, Input } from '@pressly/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/newsroom/auth-context';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const t = useTranslations('auth');
  const { login } = useAuth();
  const router = useRouter();
  // Empty. These were prefilled with a demo account during Phase 4 and the
  // defaults shipped — a production login form arriving with someone's
  // credentials already typed into it.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      router.replace('/newsroom');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-h3 font-semibold text-ink">{t('newsroomTitle')}</h1>
          <p className="mt-1 font-sans text-ui-sm text-ink-muted">{t('signInSubtitle')}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t('email')} htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label={t('password')} htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && (
            <p role="alert" className="font-sans text-ui-sm text-error">
              {error}
            </p>
          )}
          <Button type="submit" busy={busy} block>
            {busy ? t('signingIn') : t('signIn')}
          </Button>
        </form>
        <p className="mt-4 text-center">
          <Link
            href="/newsroom/forgot-password"
            className="inline-block py-1 font-sans text-ui-sm text-accent hover:underline"
          >
            {t('forgotPassword')}
          </Link>
        </p>
      </div>
    </Container>
  );
}
