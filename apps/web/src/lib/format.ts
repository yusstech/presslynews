import type { Locale } from '@pressly/types';

/** Locale-aware date formatting. Dates render in the mono font per the spec. */
export function formatDate(iso: string | undefined, locale: Locale): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}
