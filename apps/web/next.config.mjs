import createNextIntlPlugin from 'next-intl/plugin';
import { config as loadEnv } from 'dotenv';

// Config lives in one file at the repo root, shared with the API and worker.
// Next only reads .env files inside its own app directory, so load it here.
//
// Development only. On Vercel (and in any container) there is no repo-root
// .env — configuration comes from the platform, and reading a stray file there
// would be a way to get surprised by stale values.
if (process.env.NODE_ENV !== 'production') {
  loadEnv({ path: '../../.env' });
}

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
