import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaStorage } from '@pressly/storage';

/**
 * Publish stories from the command line.
 *
 * This is the intended authoring path: write the story here, run the script,
 * and it is live. The Newsroom UI still exists for quick edits, but nothing
 * requires opening a browser to publish.
 *
 * Each story may carry one hero image — give it a local file path or a URL and
 * it goes through the same sharp pipeline the Newsroom upload uses (four widths
 * × JPEG + WebP). Omit `image` and the story publishes without one; the Reader
 * has a designed treatment for that case.
 *
 *   pnpm db:publish
 *
 * Edit STORIES below, or import `publishStory` from your own script.
 */

const SIZES = [
  { name: 'large', width: 1600 },
  { name: 'tablet', width: 1024 },
  { name: 'mobile', width: 640 },
  { name: 'thumb', width: 320 },
] as const;

export interface StoryInput {
  headline: string;
  /** Plain paragraphs. Converted to the same structured JSON Tiptap produces. */
  body: string[];
  summary?: string;
  subheadline?: string;
  /** Local file path or https URL. Omit for a story with no picture. */
  image?: string;
  imageAlt?: string;
  imageCredit?: string;
  /** Topic slug, e.g. 'energy'. Must already exist. */
  topic?: string;
  /** ISO country code, e.g. 'ng'. Must already exist. */
  country?: string;
  language?: 'en' | 'ar' | 'fr' | 'de';
  isBreaking?: boolean;
  articleType?: 'NEWS' | 'ANALYSIS' | 'OPINION' | 'FEATURE' | 'INTERVIEW' | 'BRIEFING';
}

function slugify(headline: string): string {
  return (
    headline
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || `story-${Date.now()}`
  );
}

function doc(paragraphs: string[]) {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

/** ~200 words per minute, matching what the editor computes on save. */
function readingTime(paragraphs: string[]): number {
  const words = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function readSource(pathOrUrl: string): Promise<Buffer> {
  if (/^https?:\/\//.test(pathOrUrl)) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) throw new Error(`${res.status} fetching ${pathOrUrl}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return (await import('node:fs/promises')).readFile(pathOrUrl);
}

async function createMedia(
  prisma: PrismaClient,
  source: Buffer,
  alt: string | undefined,
  credit: string | undefined,
  uploaderId: string | undefined,
) {
  const storage = new MediaStorage({
    localDir:
      process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), '..', '..', 'apps', 'web', 'public'),
  });

  const metadata = await sharp(source, { failOn: 'none' }).metadata();
  const id = crypto.randomUUID();
  const base = `media/${id}`;
  const variants: Record<string, string | Record<string, string>> = {};

  variants.original = await storage.put(`${base}/original.jpg`, source, 'image/jpeg');

  const webpSet: Record<string, string> = {};
  for (const size of SIZES) {
    const width = Math.min(size.width, metadata.width ?? size.width);
    const pipeline = sharp(source).resize({ width, withoutEnlargement: true });
    const [jpeg, webp] = await Promise.all([
      pipeline.clone().jpeg({ quality: 82 }).toBuffer(),
      pipeline.clone().webp({ quality: 76 }).toBuffer(),
    ]);
    variants[size.name] = await storage.put(`${base}/${size.name}.jpg`, jpeg, 'image/jpeg');
    webpSet[size.name] = await storage.put(`${base}/${size.name}.webp`, webp, 'image/webp');
  }
  variants.webpSet = webpSet;
  if (webpSet.large) variants.webp = webpSet.large;

  return prisma.media.create({
    data: {
      id,
      storageKey: base,
      filename: `${id}.jpg`,
      mimeType: 'image/jpeg',
      size: source.byteLength,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      alt: alt ?? null,
      photographer: credit ?? null,
      uploadedById: uploaderId,
      processingStatus: 'READY',
      variants,
    },
  });
}

export async function publishStory(prisma: PrismaClient, story: StoryInput) {
  const [author, topic, country] = await Promise.all([
    prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }),
    story.topic
      ? prisma.topic.findUnique({ where: { slug: story.topic }, select: { id: true } })
      : null,
    story.country
      ? prisma.country.findUnique({ where: { code: story.country }, select: { id: true } })
      : null,
  ]);

  if (story.topic && !topic) throw new Error(`No topic "${story.topic}" — run db:seed:taxonomy`);
  if (story.country && !country) throw new Error(`No country "${story.country}"`);

  let heroImageId: string | undefined;
  if (story.image) {
    const media = await createMedia(
      prisma,
      await readSource(story.image),
      story.imageAlt,
      story.imageCredit,
      author?.id,
    );
    heroImageId = media.id;
  }

  const slug = slugify(story.headline);
  const data = {
    workingTitle: story.headline,
    headline: story.headline,
    subheadline: story.subheadline ?? null,
    summary: story.summary ?? null,
    bodyJson: doc(story.body),
    status: 'PUBLISHED' as const,
    publishedAt: new Date(),
    primaryLanguage: story.language ?? 'en',
    readingTime: readingTime(story.body),
    isBreaking: story.isBreaking ?? false,
    articleType: story.articleType ?? ('NEWS' as const),
    authorId: author?.id,
    topicId: topic?.id,
    countryId: country?.id,
    heroImageId,
  };

  // Upsert so re-running with an edited body updates the story in place rather
  // than failing on the unique slug.
  const article = await prisma.article.upsert({
    where: { slug },
    create: { ...data, slug },
    update: data,
    select: { slug: true },
  });

  return article.slug;
}

/* ------------------------------------------------------------------------- */
/* Stories to publish. Edit this list, then `pnpm db:publish`.                */
/* ------------------------------------------------------------------------- */

const STORIES: StoryInput[] = [
  {
    headline: 'Nigeria brings another substation online in Kwara',
    summary: 'A quiet milestone in a long programme to extend reliable power beyond the cities.',
    topic: 'energy',
    country: 'ng',
    image: 'https://picsum.photos/id/1076/1800/1200',
    imageAlt: 'Transmission infrastructure under an open sky.',
    imageCredit: 'Aleksandar Popovski',
    body: [
      'The substation certified this month is small on paper and significant in practice: it is the point at which a rural distribution network stops being a plan and starts carrying load.',
      'Nigeria has no shortage of generation projects on paper. What it has lacked is the unglamorous middle — the transmission and distribution that decides whether power reaches a household.',
      'The engineers who commissioned it describe the work in maintenance terms rather than milestones, which is usually a sign that a system is being built to last.',
    ],
  },
  {
    headline: 'What the grid says about a country',
    subheadline: 'Infrastructure is policy made physical.',
    summary: 'Reading national priorities in the shape of a transmission network.',
    topic: 'world',
    articleType: 'ANALYSIS',
    // No image on purpose — proving a story without a picture still reads well.
    body: [
      'A transmission map is a political document. It shows which regions were considered worth connecting, and when.',
      'Read across decades, the pattern is rarely about engineering difficulty. It is about who was in the room when the route was chosen.',
    ],
  },
];

/**
 * Drop the Reader's cache.
 *
 * This script writes to Postgres from outside the app, so it cannot call
 * `revalidateTag` itself. Without this the story is live on its own URL but
 * absent from the homepage until the cache window lapses — which looks exactly
 * like publishing silently failing.
 */
async function revalidate(slugs: string[]) {
  const base = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.log('\nREVALIDATE_SECRET not set — skipping cache invalidation.');
    console.log('Stories are live on their own URLs; listings refresh within 5 minutes.');
    return;
  }
  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ slugs }),
    });
    console.log(res.ok ? '\nReader cache invalidated.' : `\nRevalidate failed (${res.status}).`);
  } catch {
    console.log(`\nCould not reach ${base} to invalidate — is the site running?`);
  }
}

async function main() {
  const prisma = new PrismaClient();
  const published: string[] = [];
  try {
    for (const story of STORIES) {
      const slug = await publishStory(prisma, story);
      published.push(slug);
      console.log(`published  /en/article/${slug}${story.image ? '  (with image)' : '  (no image)'}`);
    }
  } finally {
    await prisma.$disconnect();
  }
  await revalidate(published);

  // Local disk only: `next start` resolves public/ against a build-time
  // snapshot, so an image written after the server booted 404s until it is
  // restarted. Object storage (R2/Cloudinary) has no such problem, and on
  // serverless the filesystem is read-only anyway — this note exists because
  // the symptom (article renders, image missing) is confusing on its own.
  const usingLocalDisk = !process.env.R2_ACCOUNT_ID;
  if (usingLocalDisk && STORIES.some((s) => s.image)) {
    console.log('Images are on local disk — restart the dev server for them to appear.');
  }
}

if (process.argv[1]?.includes('publish')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
