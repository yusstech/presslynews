/**
 * Delete everything from the local database except the real project records.
 *
 * A development database accumulates: the Phase-4 demo stories from `db:seed`,
 * plus whatever was created while testing scheduling, backdating and the
 * editor. That makes the Newsroom list a poor picture of what is actually
 * published, which is the thing it exists to show.
 *
 *   pnpm db:clear-demo
 *
 * **Refuses to run against anything but localhost.** The production connection
 * string is a paste away from the local one, and this script's whole job is
 * bulk deletion — so the guard is on the host, not on a confirmation prompt
 * that a tired person will accept.
 *
 * Revisions and status events cascade with the article. `AuditLog` does not
 * reference articles by foreign key, so its rows are left alone.
 */
import { PrismaClient } from '@prisma/client';

/** The five real project records. Everything else in a dev database is noise. */
const KEEP = [
  'samaya-group-completes-the-tabuk-380-kv-transmission-line',
  'samaya-group-completes-the-al-jawf-380-kv-transmission-line',
  'icco-completes-the-rural-damascus-daraa-400-kv-transmission-line',
  'icco-delivers-the-kwara-330-kv-transmission-substation',
  'icco-delivers-the-nnewi-800-mva-transmission-substation',
];

function assertLocal(url: string | undefined) {
  if (!url) throw new Error('DATABASE_URL is not set.');
  const host = new URL(url).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `Refusing to run: DATABASE_URL points at "${host}", not localhost.\n` +
        'This script deletes articles in bulk and is for development databases only.',
    );
  }
}

async function main() {
  assertLocal(process.env.DATABASE_URL);

  const prisma = new PrismaClient();
  try {
    const doomed = await prisma.article.findMany({
      where: { slug: { notIn: KEEP } },
      select: { slug: true, status: true },
      orderBy: { slug: 'asc' },
    });

    if (doomed.length === 0) {
      console.log('Nothing to remove — only the real records are present.');
      return;
    }

    for (const a of doomed) console.log(`  removing  ${a.status.padEnd(10)} ${a.slug}`);

    const { count } = await prisma.article.deleteMany({ where: { slug: { notIn: KEEP } } });
    const kept = await prisma.article.count();
    console.log(`\nRemoved ${count}. ${kept} article(s) remain.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
