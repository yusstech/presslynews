import { defineRouting } from 'next-intl/routing';
import { LOCALES, DEFAULT_LOCALE } from '@pressly/types';

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  // Every locale is explicit in the URL (/en, /ar, …) — good for SEO & clarity.
  localePrefix: 'always',
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
});
