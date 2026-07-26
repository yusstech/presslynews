import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { directionForLocale, isLocale, LOCALES } from '@pressly/types';
import { fontVariables } from '../fonts';
import { siteJsonLd } from '@/lib/seo';
import { siteUrl } from '@/lib/site';
import '../globals.css';

export const metadata: Metadata = {
  // Makes every relative `alternates.canonical` in a child page resolve to an
  // absolute URL. Without it Next emits a relative canonical, which some
  // crawlers resolve against the wrong origin.
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Pressly',
    template: '%s · Pressly',
  },
  description: 'Understand the world. A calm, multilingual global news platform.',
  /**
   * Google Search Console ownership.
   *
   * Google offers a DNS TXT record, an uploaded HTML file, or this meta tag.
   * DNS is unavailable while the site is on an `onrender.com` subdomain, so the
   * tag it is. The token is public by design — it appears in the HTML of every
   * page — and it stays valid when a custom domain is added later, so it is
   * checked in rather than carried as an environment variable nobody remembers
   * to set.
   */
  verification: { google: 'jdRkayndU9leUWdrLaeaSVAr6ByaDvLTjpvSjbadyKk' },
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
        {/* One publisher entity for the whole site; every article's `publisher`
            is a reference to this node rather than another copy of the name. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
