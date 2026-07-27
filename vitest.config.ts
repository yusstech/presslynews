import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const web = fileURLToPath(new URL('./apps/web/src', import.meta.url));

/**
 * Tests for the logic that is worth testing: pure functions with rules in them.
 *
 * The repo had no test framework and no test files, so `pnpm test` passed by
 * finding nothing to run — green with nothing behind it. This covers the pieces
 * where a silent regression would be expensive and invisible: the canonical and
 * structured-data policy, the autosave validator, the login limiter, and the
 * glossary's internal consistency.
 *
 * Deliberately not here: route handlers and React components. Testing those
 * properly needs a database and a renderer, and a shallow mock of both would
 * assert that the mocks work. The verification that covers them is the a11y,
 * responsive and design-system gates, which drive a real browser against a real
 * server.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': web,
      // `server-only` throws on import outside a React Server Component. It is
      // a build-time guard, not behaviour, so the modules it protects are
      // importable in a test once it is stubbed out.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // `seo.ts` derives every absolute URL from this. Fixing it makes the
    // expected values in the tests literal rather than computed the same way
    // the code under test computes them.
    env: { SITE_URL: 'https://www.presslynews.com' },
  },
});
