import { NextResponse } from 'next/server';
import { join } from 'node:path';
import { MediaStorage } from '@pressly/storage';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hero image upload.
 *
 * The four-width sharp pipeline that used to live here — and again, verbatim, in
 * the command-line publisher — is now one `storage.upload()` call, with
 * Cloudinary doing the resizing from the URL. Both call sites share it, so the
 * widths are defined in one place.
 *
 * The old 4MB cap was Vercel's request body limit. Render does not impose one,
 * so the cap here is about what is reasonable to hold in memory and hand to
 * Cloudinary, not about the platform.
 */
const MAX_BYTES = 20 * 1024 * 1024;

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { message: 'Image is larger than 20MB — please resize it first' },
      { status: 413 },
    );
  }

  const source = Buffer.from(await file.arrayBuffer());
  const alt = (form?.get('alt') as string | null)?.trim() || null;

  const storage = new MediaStorage({
    // Local mode only. `public/` so Next serves the file itself; in production
    // Cloudinary is configured and nothing touches the disk, which is the point
    // — a Render filesystem does not survive a deploy.
    localDir: process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), 'public'),
  });

  const id = crypto.randomUUID();
  let stored;
  try {
    // Rejects anything whose bytes are not an image — the check
    // `sharp.metadata()` used to perform.
    stored = await storage.upload(source, id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ message }, { status: 400 });
  }

  const media = await prisma.media.create({
    data: {
      id,
      storageKey: stored.storageKey,
      filename: file.name,
      mimeType: stored.mimeType,
      size: stored.bytes,
      width: stored.width,
      height: stored.height,
      alt,
      uploadedById: user.id,
      processingStatus: 'READY',
      // Prisma's Json input wants an index signature, which a named interface
      // does not have. `content-api.ts` casts the same way on the way out.
      variants: stored.variants as unknown as object,
    },
    select: { id: true, alt: true, variants: true },
  });

  return NextResponse.json(media, { status: 201 });
}
