/**
 * Locales & text direction for Pressly v1.
 * UI is localized in all four; article *content* stays in its original language
 * (content translation is a v2 concern).
 */

export const LOCALES = ['en', 'ar', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export type TextDirection = 'ltr' | 'rtl';

/** Only Arabic is right-to-left in the v1 locale set. */
export const RTL_LOCALES: readonly Locale[] = ['ar'];

export function directionForLocale(locale: Locale): TextDirection {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Human-readable, self-referential language names (for the language switcher). */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
};
