'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Container, Field, Input } from '@pressly/ui';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

/** Requests a reset link. The API answers identically for unknown addresses. */
export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      // Deliberately the same confirmation either way — the UI must not reveal
      // whether an address is registered.
      setSent(true);
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
          <h1 className="font-serif text-2xl font-semibold text-ink">{t('resetRequestTitle')}</h1>
          {!sent && (
            <p className="mt-2 font-sans text-sm text-ink-muted">{t('resetRequestBody')}</p>
          )}
        </div>

        {sent ? (
          <p role="status" className="text-center font-sans text-sm text-ink">
            {t('resetRequestSent')}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t('email')} htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            {error && (
              <p role="alert" className="font-sans text-ui-sm text-error">
                {error}
              </p>
            )}
            <Button type="submit" busy={busy} block>
              {busy ? t('sending') : t('sendResetLink')}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center">
          <Link href="/newsroom/login" className="inline-block py-1 font-sans text-ui-sm text-accent hover:underline">
            {t('backToSignIn')}
          </Link>
        </p>
      </div>
    </Container>
  );
}
