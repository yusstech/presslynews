import createNextIntlPlugin from 'next-intl/plugin';
import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Config lives in one file at the repo root; Next only reads .env files inside
// its own app directory, so load it here.
//
// Unconditional on purpose. `dotenv` never overwrites a variable that is
// already set, so on Vercel the platform's values win and this is a no-op with
// no file to read. Guarding it on NODE_ENV instead breaks `next build` locally,
// which runs as production and now needs DATABASE_URL to prerender.
loadEnv({ path: '../../.env' });

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS/TSX — let Next transpile them.
  transpilePackages: [
    '@pressly/ui',
    '@pressly/config',
    '@pressly/types',
    '@pressly/i18n',
    '@pressly/article-renderer',
  ],
  // Next was inferring the monorepo root from whichever lockfile it found first
  // — on one machine that was a stray package-lock.json in the home directory,
  // which puts file tracing in the wrong tree entirely. State it.
  outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), '../..'),
  images: {
    /**
     * Nothing in the Reader uses `next/image` — every picture goes through
     * `MediaImage`, a plain `<picture>` fed by Cloudinary URLs, which is why the
     * srcSet work lives in `lib/images.ts`. The optimizer was still enabled with
     * `hostname: '**'`, so `/_next/image` would fetch and re-encode any image on
     * the internet on request. That is an open proxy on someone else's
     * bandwidth. Cloudinary already does the resizing.
     */
    unoptimized: true,
  },
  experimental: {
    typedRoutes: false,
  },
};

export default withNextIntl(nextConfig);
