import { PrismaClient, type Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedHeroImages } from './seed-media';
import { seedTaxonomy } from './seed-taxonomy';

const prisma = new PrismaClient();

/**
 * DEVELOPMENT SEED. Creates demo accounts with a published, well-known
 * password — running this against production would hand anyone an editor login.
 *
 * Production needs the reference data this used to include, so that moved to
 * `seed-taxonomy.ts` (`pnpm db:seed:taxonomy`), which is safe to run anywhere.
 * Create the first real account with `pnpm db:create-admin`.
 */
const PASSWORD = 'pressly123';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== 'yes') {
  console.error(
    'Refusing to run the development seed with NODE_ENV=production.\n' +
      `It creates demo accounts with the password "${PASSWORD}".\n\n` +
      'Use `pnpm db:seed:taxonomy` for reference data and `pnpm db:create-admin`\n' +
      'for the first account. Set ALLOW_DEV_SEED=yes only if you are certain.',
  );
  process.exit(1);
}

function doc(...paragraphs: string[]): Prisma.InputJsonValue {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 10);

  // Reference data — shared with production via `pnpm db:seed:taxonomy`.
  const { countries, topics } = await seedTaxonomy(prisma);

  // ── Users (one per v1 role) ─────────────────────────────────────────────────
  const userData = [
    { email: 'admin@pressly.dev', name: 'Amina Farouk', slug: 'amina-farouk', role: 'SUPER_ADMIN' as const },
    { email: 'editor@pressly.dev', name: 'Sophie Bernard', slug: 'sophie-bernard', role: 'EDITOR' as const, locale: 'fr' },
    { email: 'journalist@pressly.dev', name: 'Daniel Okafor', slug: 'daniel-okafor', role: 'JOURNALIST' as const },
    { email: 'copy@pressly.dev', name: 'Layla Haddad', slug: 'layla-haddad', role: 'COPY_EDITOR' as const, locale: 'ar' },
  ];
  for (const u of userData) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, hashedPassword: hashed },
      update: { name: u.name, role: u.role },
    });
  }
  const users = Object.fromEntries((await prisma.user.findMany()).map((u) => [u.email, u]));

  // ── Published articles ──────────────────────────────────────────────────────
  const articles: Prisma.ArticleCreateInput[] = [
    {
      workingTitle: 'KSA northern grid',
      headline: 'Saudi Arabia accelerates its high-voltage grid across the north',
      subheadline:
        'New transmission lines from Tabuk to Al Jouf aim to move renewable power to where it is needed.',
      summary:
        'A wave of high-voltage transmission projects is reshaping how electricity moves across the Kingdom.',
      slug: 'saudi-arabia-grid-expansion',
      status: 'PUBLISHED',
      articleType: 'ANALYSIS',
      primaryLanguage: 'en',
      readingTime: 3,
      publishedAt: new Date('2026-07-22T08:00:00Z'),
      bodyJson: doc(
        'Across the northern provinces, a new generation of transmission lines is quietly changing the shape of Saudi Arabia’s power system.',
        'The Kingdom’s best solar and wind resources sit far from its largest cities. Moving that power efficiently is an engineering problem as much as a political one.',
      ),
      author: { connect: { id: users['journalist@pressly.dev']!.id } },
      country: { connect: { id: countries.sa!.id } },
      topic: { connect: { id: topics.energy!.id } },
    },
    {
      workingTitle: 'Kwara substation',
      headline: 'Kwara substation reaches a milestone for Nigeria’s rural grid',
      subheadline: 'A notarised handover marks progress in extending reliable power beyond the cities.',
      summary: 'The newly certified substation in Kwara is a small but meaningful step.',
      slug: 'nigeria-substation-milestone',
      status: 'PUBLISHED',
      articleType: 'NEWS',
      primaryLanguage: 'en',
      isBreaking: true,
      readingTime: 2,
      publishedAt: new Date('2026-07-23T14:30:00Z'),
      bodyJson: doc(
        'The certification of the Kwara substation, attested and notarised this week, closes a chapter that began years ago.',
      ),
      author: { connect: { id: users['journalist@pressly.dev']!.id } },
      country: { connect: { id: countries.ng!.id } },
      topic: { connect: { id: topics.energy!.id } },
    },
    {
      workingTitle: 'Daraa reconstruction',
      headline: 'إعادة بناء شبكة الكهرباء في درعا خطوة بخطوة',
      subheadline: 'مشروع محطة تحويل جديد يعيد التيار إلى مناطق تضررت خلال سنوات الحرب.',
      summary: 'يمثل مشروع محطة درعا محاولة هادئة لإعادة الخدمات الأساسية.',
      slug: 'daraa-reconstruction-power',
      status: 'PUBLISHED',
      articleType: 'FEATURE',
      primaryLanguage: 'ar',
      readingTime: 2,
      publishedAt: new Date('2026-07-21T10:00:00Z'),
      bodyJson: doc(
        'في درعا، يعمل المهندسون على إعادة وصل ما انقطع. محطة التحويل الجديدة ليست مجرد منشأة تقنية، بل وعد بعودة الحياة الطبيعية.',
      ),
      author: { connect: { id: users['copy@pressly.dev']!.id } },
      country: { connect: { id: countries.sy!.id } },
      topic: { connect: { id: topics.energy!.id } },
    },
    {
      workingTitle: 'France electricity market',
      headline: 'La France repense son marché de l’électricité',
      subheadline: 'Un débat calme mais décisif sur la manière de tarifer une énergie plus propre.',
      summary: 'La France cherche un équilibre entre prix stables et transition rapide.',
      slug: 'europe-energy-market-shift',
      status: 'PUBLISHED',
      articleType: 'ANALYSIS',
      primaryLanguage: 'fr',
      readingTime: 2,
      publishedAt: new Date('2026-07-20T09:00:00Z'),
      bodyJson: doc(
        'Le débat semble technique, mais ses conséquences toucheront chaque foyer.',
      ),
      author: { connect: { id: users['editor@pressly.dev']!.id } },
      country: { connect: { id: countries.fr!.id } },
      topic: { connect: { id: topics.business!.id } },
    },
  ];

  for (const a of articles) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      create: {
        ...a,
        statusEvents: {
          create: { fromStatus: null, toStatus: 'PUBLISHED', actorId: users['editor@pressly.dev']!.id },
        },
      },
      update: {},
    });
  }

  // Hero imagery. Without this every card renders as a grey placeholder, which
  // makes the Reader impossible to review honestly.
  await seedHeroImages(prisma, users['editor@pressly.dev']!.id);

  // eslint-disable-next-line no-console
  console.log('Seeded. Login with editor@pressly.dev / ' + PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
