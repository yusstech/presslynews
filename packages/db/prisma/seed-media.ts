import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { MediaStorage } from '@pressly/storage';

/**
 * Seeds hero imagery.
 *
 * The seed used to create no media at all, so six of seven articles rendered as
 * flat grey placeholders — which made the Reader impossible to judge and hid
 * the fact that the card hover treatment only existed on cards with an image.
 *
 * This deliberately mirrors `apps/api/src/media/media.service.ts`: the same
 * widths, the same JPEG quality, the same `media/<id>/<name>.jpg` layout and
 * the same MediaStorage, so seeded media is indistinguishable from an editor
 * upload and exercises the same local-disk fallback.
 *
 * LICENSING: these are Unsplash-licensed photographs served via Lorem Picsum,
 * credited to their photographers below. They are DEV SEED DATA — fine for
 * development and review, not a substitute for the client licensing its own
 * imagery for production.
 */

/** Same widths as the API pipeline. Keep in step if that changes. */
const SIZES = [
  { name: 'large', width: 1600 },
  { name: 'tablet', width: 1024 },
  { name: 'mobile', width: 640 },
  { name: 'thumb', width: 320 },
] as const;

const SOURCE = 'Unsplash (via Lorem Picsum)';
const LICENCE = 'Unsplash License — free to use. Dev seed data only.';

/**
 * A pool of photographs, assigned in order to any article that lacks a hero.
 *
 * Deliberately not keyed by article slug: most articles in a working database
 * were created through the Newsroom and carry generated slugs, so a fixed
 * mapping would leave exactly those articles — the ones being reviewed — grey.
 *
 * `credit` is the real photographer from the Picsum metadata API. `alt`
 * describes the photograph for screen readers; it is honest about the image
 * rather than restating the headline.
 */
export const HERO_POOL: Array<{ picsumId: number; credit: string; alt: string }> = [
  { picsumId: 1015, credit: 'Alexey Topolyanskiy', alt: 'A wide arid landscape under an open sky.' },
  { picsumId: 1043, credit: 'Christian Joudrey', alt: 'A rugged coastline beneath low cloud.' },
  { picsumId: 1039, credit: 'Andrew Coelho', alt: 'A road running through open terrain at dusk.' },
  { picsumId: 1016, credit: 'Philippe Wuyts', alt: 'A misted valley seen from high ground.' },
  { picsumId: 1057, credit: 'Stefan Kunze', alt: 'Open water meeting a distant shoreline.' },
  { picsumId: 1071, credit: 'Tim Stief', alt: 'A mountain ridge under a clear sky.' },
  { picsumId: 110, credit: 'Kenneth Thewissen', alt: 'A calm rural horizon at first light.' },
  { picsumId: 142, credit: 'Vadim Sherbakov', alt: 'Still water reflecting an overcast sky.' },
];

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Downloads, derives variants and records Media rows, then attaches each image
 * to its article. Safe to re-run: an article that already has a hero is left
 * alone, so re-seeding doesn't re-download or pile up duplicates.
 */
export async function seedHeroImages(prisma: PrismaClient, uploaderId: string) {
  // Same directory the API serves at /uploads.
  const localDir =
    process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), '..', '..', 'apps', 'api', 'uploads');
  const storage = new MediaStorage({ localDir });

  await fs.mkdir(localDir, { recursive: true });

  // Only articles that need one. Ordered by slug so a re-run assigns the same
  // photograph to the same article.
  const needing = await prisma.article.findMany({
    where: { heroImageId: null },
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' },
  });

  let created = 0;

  for (const [i, article] of needing.entries()) {
    const spec = HERO_POOL[i % HERO_POOL.length]!;

    let source: Buffer;
    try {
      source = await download(`https://picsum.photos/id/${spec.picsumId}/1800/1200`);
    } catch (err) {
      // Never let a flaky network fail the whole seed — the rest still works.
      console.log(`  · ${article.slug} — image download failed (${String(err)}), skipping`);
      continue;
    }

    const id = crypto.randomUUID();
    const base = `media/${id}`;
    const metadata = await sharp(source).metadata();
    const variants: Record<string, unknown> = {};

    variants.original = await storage.put(`${base}/original.jpg`, source, 'image/jpeg');

    for (const size of SIZES) {
      const width = Math.min(size.width, metadata.width ?? size.width);
      const buf = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      variants[size.name] = await storage.put(`${base}/${size.name}.jpg`, buf, 'image/jpeg');
    }

    // WebP at every width — mirrors the API pipeline.
    const webpSet: Record<string, string> = {};
    for (const size of SIZES) {
      const width = Math.min(size.width, metadata.width ?? size.width);
      const buf = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 76 })
        .toBuffer();
      webpSet[size.name] = await storage.put(`${base}/${size.name}.webp`, buf, 'image/webp');
    }
    variants.webpSet = webpSet;
    variants.webp = webpSet.large!;

    const media = await prisma.media.create({
      data: {
        id,
        storageKey: base,
        filename: `${article.slug}.jpg`,
        mimeType: 'image/jpeg',
        size: source.byteLength,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        alt: spec.alt,
        photographer: spec.credit,
        copyrightHolder: SOURCE,
        usageRights: LICENCE,
        uploadedById: uploaderId,
        processingStatus: 'READY',
        variants,
      },
    });

    await prisma.article.update({
      where: { id: article.id },
      data: { heroImageId: media.id },
    });
    created++;
  }

  console.log(
    `  media: ${created}/${needing.length} hero image(s) created (stored under ${localDir})`,
  );
}
