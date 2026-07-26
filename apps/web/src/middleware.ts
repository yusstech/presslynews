import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { countryFromHeaders, localeForCountry } from './i18n/geo';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * i18n middleware with a geo first-guess.
 *
 * If a visitor arrives without a locale in the path and without a saved
 * preference, we redirect them to their country's edition (geo header). If we
 * can't guess, next-intl falls back to Accept-Language, then the default
 * locale. Once the user has a NEXT_LOCALE cookie, geo never overrides it.
 */
export default function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const hasLocalePrefix = routing.locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  const hasSavedPreference = request.cookies.has('NEXT_LOCALE');

  if (!hasLocalePrefix && !hasSavedPreference) {
    const geoLocale = localeForCountry(countryFromHeaders(request.headers));
    if (geoLocale) {
      const url = request.nextUrl.clone();
      url.pathname = `/${geoLocale}${pathname === '/' ? '' : pathname}`;
      const response = NextResponse.redirect(url);
      response.cookies.set('NEXT_LOCALE', geoLocale, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
      return response;
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Run on everything except API routes, static files, and Next internals.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
