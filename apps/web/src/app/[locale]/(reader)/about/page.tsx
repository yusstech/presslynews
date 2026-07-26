import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@pressly/types';
import { Prose, StaticPage } from '@/components/static-page';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('aboutTitle') };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('pages');

  return (
    <StaticPage title={t('aboutTitle')}>
      <Prose>{t('aboutBody1')}</Prose>
      <Prose>{t('aboutBody2')}</Prose>
    </StaticPage>
  );
}
