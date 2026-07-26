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
  return { title: t('editorialTitle') };
}

export default async function EditorialStandardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('pages');

  return (
    <StaticPage title={t('editorialTitle')}>
      <Prose>{t('editorialBody1')}</Prose>
      <Prose>{t('editorialBody2')}</Prose>
    </StaticPage>
  );
}
