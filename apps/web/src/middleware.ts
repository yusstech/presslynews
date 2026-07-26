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
/**
 * Sends every request to the one canonical host.
 *
 * The site is reachable at both `pressly-6282.onrender.com` and the real
 * domain. Canonical tags already tell a search engine which one counts, but
 * they do nothing for a human who bookmarks the platform URL, or for a link
 * someone pastes into a chat. A 308 removes the ambiguity instead of just
 * declaring it.
 *
 * Deliberately narrow: it redirects the platform subdomain, not "any host that
 * is not canonical". The broader rule is tempting and would also catch a stray
 * domain someone points here later, but a health probe or internal request that
 * arrives with a container IP or a single-label hostname is also "not
 * canonical", and answering that with a 308 fails a deploy. Redirecting exactly
 * the host we are trying to retire cannot misfire.
 *
 * `/healthz` is excluded by the matcher as well, so a probe is never touched
 * even if the platform hostname is what it uses.
 *
 * A missing or unparseable SITE_URL means no redirect, so a misconfigured
 * environment degrades to "serves on every host" rather than "redirects into a
 * loop".
 */
const RETIRED_HOST_SUFFIX = '.onrender.com';

function canonicalHostRedirect(request: NextRequest): NextResponse | null {
  const configured = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) return null;

  let canonical: URL;
  try {
    canonical = new URL(configured);
  } catch {
    return null;
  }

  const host = request.headers.get('host');
  if (!host || host === canonical.host) return null;
  if (!host.split(':')[0]!.endsWith(RETIRED_HOST_SUFFIX)) return null;
  // Nothing to redirect to if the canonical host is itself the platform one.
  if (canonical.host.endsWith(RETIRED_HOST_SUFFIX)) return null;

  const url = request.nextUrl.clone();
  url.protocol = canonical.protocol;
  url.host = canonical.host;
  // Assigning `host` leaves any existing port in place, which would send the
  // visitor to www.example.com:3000.
  url.port = canonical.port;
  // 308 rather than 307: permanent, and it preserves the method, which matters
  // for anything POSTing to a route on the old host.
  return NextResponse.redirect(url, 308);
}

export default function middleware(request: NextRequest): NextResponse {
  const wrongHost = canonicalHostRedirect(request);
  if (wrongHost) return wrongHost;

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
  // Everything except API routes, the health probe, static files and Next
  // internals. `healthz` is excluded so a liveness check never receives a
  // locale redirect or a canonical-host 308.
  matcher: ['/((?!api|_next|_vercel|healthz|.*\\..*).*)'],
};
