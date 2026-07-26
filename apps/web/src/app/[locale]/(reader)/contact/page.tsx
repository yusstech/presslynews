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
  return { title: t('contactTitle') };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('pages');

  return (
    <StaticPage title={t('contactTitle')}>
      <Prose>{t('contactBody1')}</Prose>
      <Prose>{t('contactBody2')}</Prose>
    </StaticPage>
  );
}
