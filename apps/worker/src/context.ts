import { config } from 'dotenv';
import { join } from 'path';
import { PrismaClient } from '@pressly/db';
import { ArticleSearchIndex } from '@pressly/search';
import { MediaStorage } from '@pressly/storage';

// Config lives in one file at the repo root, shared with the API.
config({ path: join(process.cwd(), '../../.env') });
config();

export const prisma = new PrismaClient();

export const searchIndex = new ArticleSearchIndex();

/**
 * Derived variants must land beside the originals. With R2 configured that is
 * automatic; on the local-disk fallback the API is the process serving
 * /uploads, so we write into its directory unless told otherwise.
 */
export const storage = new MediaStorage({
  localDir: process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), '../api/uploads'),
});

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const log = {
  info: (msg: string) => console.log(`[worker] ${msg}`),
  warn: (msg: string) => console.warn(`[worker] ${msg}`),
  error: (msg: string) => console.error(`[worker] ${msg}`),
};
