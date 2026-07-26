import { PrismaClient } from '@pressly/db';

/**
 * One Prisma client per process.
 *
 * Two reasons this is a singleton rather than a `new PrismaClient()` per call
 * site. In development, Next's hot reload re-evaluates modules on every edit,
 * and a fresh client each time exhausts Postgres connections within a few
 * saves. In production on serverless, each warm instance keeps its client
 * between invocations, so the pool is reused instead of rebuilt.
 *
 * The connection string itself must be the *pooled* one on Neon — serverless
 * opens far more concurrent clients than a direct Postgres connection limit
 * allows. Migrations use DIRECT_DATABASE_URL, which bypasses the pooler.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
