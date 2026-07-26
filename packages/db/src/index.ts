/**
 * The Pressly database package.
 *
 * It owns the Prisma schema, migrations and seed, and re-exports the generated
 * client so that every process talking to Postgres — the API and the BullMQ
 * worker — shares one set of model types instead of each generating its own.
 */
export * from '@prisma/client';
