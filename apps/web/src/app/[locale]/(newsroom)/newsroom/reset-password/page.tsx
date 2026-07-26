'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Container, Field, Input } from '@pressly/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Completes a password reset. Reached only from the emailed link, which carries
 * the single-use token as a query parameter.
 *
 * Reading that parameter opts the route out of prerendering, so the form sits
 * behind a Suspense boundary and the shell stays static.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Check locally first so an obvious typo costs no round trip.
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('passwordTooShort'));
    if (password !== confirm) return setError(t('passwordMismatch'));

    setBusy(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      // Give the confirmation a beat to register before moving on.
      setTimeout(() => router.replace('/newsroom/login'), 2500);
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
          <h1 className="font-serif text-2xl font-semibold text-ink">{t('newPasswordTitle')}</h1>
        </div>

        {done ? (
          <p role="status" className="text-center font-sans text-sm text-success">
            {t('resetSuccess')}
          </p>
        ) : !token ? (
          <p role="alert" className="text-center font-sans text-sm text-error">
            {t('missingToken')}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t('newPassword')} htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Field label={t('confirmPassword')} htmlFor="confirm">
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>
            {error && (
              <p role="alert" className="font-sans text-ui-sm text-error">
                {error}
              </p>
            )}
            <Button type="submit" busy={busy} block>
              {busy ? t('updating') : t('updatePassword')}
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
