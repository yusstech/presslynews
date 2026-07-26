import type { Locale } from '@pressly/types';
import { isLocale } from '@pressly/types';

/**
 * Maps an ISO country code (from the edge geo header) to the locale of that
 * country's edition. Used only as a *first guess* — the reader can always
 * override with the language switcher, and the choice is remembered.
 *
 * Reflects the client's real footprint (KSA, Syria, Nigeria) plus the four
 * launch locales.
 */
const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // Arabic
  SA: 'ar', // Saudi Arabia
  SY: 'ar', // Syria
  IQ: 'ar', // Iraq
  AE: 'ar',
  EG: 'ar',
  JO: 'ar',
  QA: 'ar',
  KW: 'ar',
  // French
  FR: 'fr',
  BE: 'fr',
  SN: 'fr', // Senegal (Francophone Africa)
  CI: 'fr',
  MA: 'fr', // Morocco — French widely used
  // German
  DE: 'de',
  AT: 'de',
  CH: 'de',
  // English (explicit; everything else falls back to English)
  US: 'en',
  GB: 'en',
  NG: 'en', // Nigeria
  KE: 'en',
  ZA: 'en',
};

/** Reads the country from common edge geo headers (Vercel / Cloudflare). */
export function countryFromHeaders(headers: Headers): string | undefined {
  return (
    headers.get('x-vercel-ip-country') ??
    headers.get('cf-ipcountry') ??
    headers.get('x-country') ??
    undefined
  )?.toUpperCase();
}

export function localeForCountry(country: string | undefined): Locale | undefined {
  if (!country) return undefined;
  const locale = COUNTRY_TO_LOCALE[country];
  return locale && isLocale(locale) ? locale : undefined;
}
