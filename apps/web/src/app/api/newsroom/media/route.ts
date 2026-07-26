import { NextResponse } from 'next/server';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaStorage } from '@pressly/storage';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hero image upload.
 *
 * Same pipeline the NestJS media service ran, moved here: four JPEG widths plus
 * WebP at each, stored through `MediaStorage`, which uses R2 when configured
 * and local disk otherwise.
 *
 * NOTE: Vercel caps a request body at 4.5MB, so uploads above that fail before
 * this handler runs. For a single admin who can resize first that is a fair
 * trade for deleting a service; the fix, if it ever bites, is a presigned
 * direct-to-R2 upload rather than routing bytes through a function.
 */
const SIZES = [
  { name: 'large', width: 1600 },
  { name: 'tablet', width: 1024 },
  { name: 'mobile', width: 640 },
  { name: 'thumb', width: 320 },
] as const;

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res as Response;
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ message: 'Only images can be uploaded' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: 'Image is larger than 4MB — please resize it first' },
      { status: 413 },
    );
  }

  const source = Buffer.from(await file.arrayBuffer());
  const alt = (form?.get('alt') as string | null)?.trim() || null;

  // `failOn: 'none'` so a slightly malformed but renderable file still uploads.
  const metadata = await sharp(source, { failOn: 'none' }).metadata().catch(() => null);
  if (!metadata?.width) {
    return NextResponse.json({ message: 'That file is not a readable image' }, { status: 400 });
  }

  const storage = new MediaStorage({
    // `public/` so Next serves the files itself. Local disk is a development
    // convenience only — production sets the R2 credentials, because a
    // serverless filesystem does not persist between requests.
    localDir: process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), 'public'),
  });

  const id = crypto.randomUUID();
  const base = `media/${id}`;
  const variants: Record<string, string | Record<string, string>> = {};

  variants.original = await storage.put(`${base}/original.jpg`, source, 'image/jpeg');

  const webpSet: Record<string, string> = {};
  for (const size of SIZES) {
    const width = Math.min(size.width, metadata.width);
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

  const media = await prisma.media.create({
    data: {
      id,
      storageKey: base,
      filename: file.name,
      mimeType: 'image/jpeg',
      size: source.byteLength,
      width: metadata.width,
      height: metadata.height ?? null,
      alt,
      uploadedById: user.id,
      processingStatus: 'READY',
      variants,
    },
    select: { id: true, alt: true, variants: true },
  });

  return NextResponse.json(media, { status: 201 });
}
