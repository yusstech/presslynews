import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { QueueService } from '../queue/queue.service';
import type { AuthUser } from '../common/decorators';

/** Responsive/format variants generated for every uploaded image. */
const SIZES = [
  { name: 'large', width: 1600 },
  { name: 'tablet', width: 1024 },
  { name: 'mobile', width: 640 },
  { name: 'thumb', width: 320 },
] as const;

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private queue: QueueService,
  ) {}

  /**
   * Processes an uploaded image into the responsive + WebP variants an editor
   * needs to see straight away, stores them, and records the metadata. The
   * costlier AVIF pass is handed to the worker so the upload returns promptly.
   */
  async uploadImage(
    user: AuthUser,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    meta: { alt?: string; caption?: string; credit?: string; countryId?: string } = {},
  ) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are supported');
    }

    const id = crypto.randomUUID();
    const base = `media/${id}`;
    const image = sharp(file.buffer, { failOn: 'none' });
    const metadata = await image.metadata();

    // Prisma's Json input type: string URLs plus the nested webpSet map.
    const variants: Record<string, string | Record<string, string>> = {};

    // Keep the original.
    const ext = extFor(file.mimetype);
    variants.original = await this.storage.put(`${base}/original.${ext}`, file.buffer, file.mimetype);

    // Resized JPEG variants (never upscale beyond the source width).
    for (const size of SIZES) {
      const width = Math.min(size.width, metadata.width ?? size.width);
      const buf = await sharp(file.buffer)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      variants[size.name] = await this.storage.put(`${base}/${size.name}.jpg`, buf, 'image/jpeg');
    }

    // WebP at every width. Serving JPEG only meant a 2× phone downloaded the
    // 1024px crop for each card; WebP at the same widths roughly halves that.
    const webpSet: Record<string, string> = {};
    for (const size of SIZES) {
      const width = Math.min(size.width, metadata.width ?? size.width);
      const buf = await sharp(file.buffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 76 })
        .toBuffer();
      webpSet[size.name] = await this.storage.put(
        `${base}/${size.name}.webp`,
        buf,
        'image/webp',
      );
    }
    variants.webpSet = webpSet;
    // Kept for media recorded before webpSet existed. `large` is absent only if
    // SIZES is empty, but keep the fallback honest rather than asserting.
    if (webpSet.large) variants.webp = webpSet.large;

    const media = await this.prisma.media.create({
      data: {
        id,
        storageKey: base,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        alt: meta.alt,
        caption: meta.caption,
        photographer: meta.credit,
        countryId: meta.countryId || null,
        uploadedById: user.id,
        processingStatus: 'READY',
        variants,
      },
    });

    await this.queue.optimizeMedia(media.id);
    return media;
  }
}

function extFor(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}
