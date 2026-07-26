import createNextIntlPlugin from 'next-intl/plugin';
import { config as loadEnv } from 'dotenv';

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
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    typedRoutes: false,
  },
};

export default withNextIntl(nextConfig);
