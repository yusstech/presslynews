import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { directionForLocale, isLocale, LOCALES } from '@pressly/types';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Pressly',
    template: '%s · Pressly',
  },
  description: 'Understand the world. A calm, multilingual global news platform.',
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = directionForLocale(locale);

  return (
    <html lang={locale} dir={dir} className={fontVariables} suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
