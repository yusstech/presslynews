import { PrismaClient } from '@prisma/client';

/**
 * Reference data the product cannot function without: languages, countries and
 * topics. Every article joins to a country and a topic, and the Reader's
 * section nav is built from topics — an empty database gives you a site with no
 * navigation and no way to file a story.
 *
 * Kept separate from `seed.ts` because that file also creates four demo
 * accounts with the password `pressly123`. Taxonomy is safe to run in
 * production; demo accounts are emphatically not. Splitting them means
 * production never has to run a script that could create one.
 *
 * Idempotent — upserts throughout, so it is safe to re-run after adding a
 * country or topic.
 */
export async function seedTaxonomy(prisma: PrismaClient) {
  await prisma.language.createMany({
    data: [
      { code: 'en', name: 'English', direction: 'ltr' },
      { code: 'ar', name: 'العربية', direction: 'rtl' },
      { code: 'fr', name: 'Français', direction: 'ltr' },
      { code: 'de', name: 'Deutsch', direction: 'ltr' },
    ],
    skipDuplicates: true,
  });

  const countryData = [
    { code: 'sa', name: 'Saudi Arabia', region: 'Middle East', defaultLanguage: 'ar' },
    { code: 'ng', name: 'Nigeria', region: 'West Africa', defaultLanguage: 'en' },
    { code: 'sy', name: 'Syria', region: 'Middle East', defaultLanguage: 'ar' },
    { code: 'fr', name: 'France', region: 'Europe', defaultLanguage: 'fr' },
    { code: 'de', name: 'Germany', region: 'Europe', defaultLanguage: 'de' },
  ];
  for (const c of countryData) {
    await prisma.country.upsert({ where: { code: c.code }, create: c, update: c });
  }

  // The section nav in apps/web/src/components/site-header.tsx links
  // /topic/<slug> for world, business, energy, technology and culture — those
  // slugs must exist here or the header points at empty pages.
  const topicData = [
    { slug: 'energy', name: 'Energy' },
    { slug: 'world', name: 'World' },
    { slug: 'business', name: 'Business' },
    { slug: 'technology', name: 'Technology' },
    { slug: 'culture', name: 'Culture' },
  ];
  for (const t of topicData) {
    await prisma.topic.upsert({ where: { slug: t.slug }, create: t, update: t });
  }

  const countries = Object.fromEntries((await prisma.country.findMany()).map((c) => [c.code, c]));
  const topics = Object.fromEntries((await prisma.topic.findMany()).map((t) => [t.slug, t]));

  return { countries, topics };
}

/** Standalone entry point: `pnpm db:seed:taxonomy`. Safe in production. */
async function main() {
  const prisma = new PrismaClient();
  try {
    const { countries, topics } = await seedTaxonomy(prisma);
    // eslint-disable-next-line no-console
    console.log(
      `Taxonomy seeded: ${Object.keys(countries).length} countries, ${Object.keys(topics).length} topics.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when executed directly, not when imported by seed.ts.
if (process.argv[1] && process.argv[1].includes('seed-taxonomy')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
