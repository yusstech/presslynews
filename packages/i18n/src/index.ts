import type { Locale } from '@pressly/types';
import { LOCALES, DEFAULT_LOCALE, directionForLocale, isLocale } from '@pressly/types';

import en from '../messages/en.json';
import ar from '../messages/ar.json';
import fr from '../messages/fr.json';
import de from '../messages/de.json';

/** Message catalog shape (mirrors en.json — the reference locale). */
export type Messages = typeof en;

export const messages: Record<Locale, Messages> = {
  en,
  ar: ar as Messages,
  fr: fr as Messages,
  de: de as Messages,
};

export function getMessages(locale: string): Messages {
  return isLocale(locale) ? messages[locale] : messages[DEFAULT_LOCALE];
}

export { LOCALES, DEFAULT_LOCALE, directionForLocale, isLocale };
export type { Locale };
