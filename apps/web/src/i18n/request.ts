import { getRequestConfig } from 'next-intl/server';
import { getMessages, isLocale, DEFAULT_LOCALE } from '@pressly/i18n';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale: locale ?? DEFAULT_LOCALE,
    messages: getMessages(locale),
  };
});
