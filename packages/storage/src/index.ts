import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { MediaVariants } from '@pressly/types';

/**
 * Image storage.
 *
 * This used to be an S3 client plus a `sharp` pipeline that resized every
 * upload into four widths × JPEG and WebP — eight derivatives, eight PUTs, and
 * a native binary that has to compile for whatever platform the app is deployed
 * to. Cloudinary does the same resizing from the URL, so the pipeline is now one
 * upload and a handful of strings.
 *
 * The returned `variants` keep the exact shape the old pipeline produced, so
 * `srcSetFrom`, `webpSrcSetFrom` and `MediaImage` did not change, and media rows
 * written before this still resolve.
 *
 * Without Cloudinary credentials it writes the original to local disk and
 * returns a single variant. That is a development convenience only: a Render
 * service has an ephemeral filesystem, so anything written there is gone at the
 * next deploy.
 */

/** Responsive widths, unchanged from the sharp pipeline they replace. */
const WIDTHS = [
  ['thumb', 320],
  ['mobile', 640],
  ['tablet', 1024],
  ['large', 1600],
] as const;

export interface UploadedImage {
  /** Cloudinary public_id, or the local `media/<id>` prefix. */
  storageKey: string;
  width: number | null;
  height: number | null;
  bytes: number;
  mimeType: string;
  variants: MediaVariants;
}

export interface MediaStorageOptions {
  /** Where the local fallback writes. Served from the web app's `public/`. */
  localDir: string;
}

/**
 * Identifies the format from the file's own bytes.
 *
 * `sharp.metadata()` used to be what rejected a non-image, and dropping sharp
 * would have left only the browser-supplied Content-Type — which the uploader
 * controls. Magic bytes are the file telling the truth about itself.
 */
export function sniffImage(b: Buffer): { ext: string; mime: string } | null {
  if (b.length < 12) return null;
  const ascii = (start: number, end: number) => b.subarray(start, end).toString('ascii');

  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return { ext: 'png', mime: 'image/png' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (ascii(0, 3) === 'GIF') return { ext: 'gif', mime: 'image/gif' };
  if (ascii(4, 8) === 'ftyp' && ascii(8, 12).startsWith('avif'))
    return { ext: 'avif', mime: 'image/avif' };
  return null;
}

function cloudinaryConfigured(): boolean {
  // CLOUDINARY_URL is the single-variable form; the SDK reads it on its own.
  if (process.env.CLOUDINARY_URL) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

/**
 * Checks the variable's shape before the SDK ever sees it.
 *
 * The Cloudinary SDK parses `CLOUDINARY_URL` when the module is *imported* and
 * throws on anything malformed. Importing it at the top of this file therefore
 * made a typo in one environment variable fail `next build` outright, during
 * "Collecting page data", with a stack trace pointing at a bundled route file
 * and no mention of which variable was wrong.
 *
 * The overwhelmingly common malformation is pasting the whole line from the
 * Cloudinary dashboard — `CLOUDINARY_URL=cloudinary://…` — into a value field,
 * so that is called out by name.
 */
function assertCloudinaryUrl(): void {
  const url = process.env.CLOUDINARY_URL;
  if (!url || url.startsWith('cloudinary://')) return;

  const hint = url.includes('CLOUDINARY_URL=')
    ? ' It looks like the whole `CLOUDINARY_URL=…` line was pasted as the value — keep only the part after the first `=`.'
    : '';
  throw new Error(
    `CLOUDINARY_URL must begin with "cloudinary://" (got "${url.slice(0, 24)}…").${hint}`,
  );
}

type CloudinarySdk = (typeof import('cloudinary'))['v2'];
let sdk: Promise<CloudinarySdk> | null = null;

/**
 * Loads and configures the SDK on first use rather than at import.
 *
 * Deferring it keeps a bad credential a *runtime* error on the one route that
 * uploads, instead of a build failure across the whole app.
 */
function getCloudinary(): Promise<CloudinarySdk> {
  if (!sdk) {
    assertCloudinaryUrl();
    sdk = import('cloudinary').then(({ v2 }) => {
      v2.config({
        // Without this the SDK appends an `?_a=…` analytics parameter to every
        // URL it builds — eight of them in each srcSet, telling Cloudinary
        // which SDK we use and nothing useful to us.
        analytics: false,
        secure: true,
        // CLOUDINARY_URL, when set, has already configured the credentials.
        ...(process.env.CLOUDINARY_URL
          ? {}
          : {
              cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
              api_key: process.env.CLOUDINARY_API_KEY,
              api_secret: process.env.CLOUDINARY_API_SECRET,
            }),
      });
      return v2;
    });
  }
  return sdk;
}

export class MediaStorage {
  readonly mode: 'cloudinary' | 'local';
  private readonly localDir: string;

  constructor(options: MediaStorageOptions) {
    this.localDir = options.localDir;
    this.mode = cloudinaryConfigured() ? 'cloudinary' : 'local';
  }

  /**
   * Stores one image and returns everything the `Media` row needs.
   *
   * `id` is the Media row's id, so the stored object and the database row can
   * always be matched up by eye.
   */
  async upload(source: Buffer, id: string): Promise<UploadedImage> {
    const kind = sniffImage(source);
    if (!kind) throw new Error('That file is not a readable image');

    return this.mode === 'cloudinary'
      ? this.toCloudinary(source, id, kind.mime)
      : this.toLocalDisk(source, id, kind);
  }

  private async toCloudinary(source: Buffer, id: string, mime: string): Promise<UploadedImage> {
    const cloudinary = await getCloudinary();
    const publicId = `pressly/media/${id}`;

    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'image', overwrite: true },
        (error, uploaded) => {
          if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
          else if (!uploaded) reject(new Error('Cloudinary upload returned no result'));
          else resolve(uploaded as unknown as Record<string, unknown>);
        },
      );
      stream.end(source);
    });

    // `crop: 'limit'` never upscales — the same guarantee `withoutEnlargement`
    // gave, so a small source still yields one honest variant rather than four
    // interpolated ones.
    const at = (width: number, format: 'jpg' | 'webp') =>
      cloudinary.url(publicId, {
        secure: true,
        format,
        version: result.version as number | undefined,
        transformation: [{ width, crop: 'limit', quality: 'auto' }],
      });

    const variants: MediaVariants = { original: result.secure_url as string };
    const webpSet: NonNullable<MediaVariants['webpSet']> = {};
    for (const [name, width] of WIDTHS) {
      variants[name] = at(width, 'jpg');
      webpSet[name] = at(width, 'webp');
    }
    variants.webpSet = webpSet;
    variants.webp = webpSet.large;

    return {
      storageKey: publicId,
      width: (result.width as number) ?? null,
      height: (result.height as number) ?? null,
      bytes: (result.bytes as number) ?? source.byteLength,
      mimeType: mime,
      variants,
    };
  }

  /**
   * Development fallback: the original, once, at a site-relative path.
   *
   * No derivatives — resizing is Cloudinary's job now, and `srcSetFrom` already
   * declines to emit a one-candidate srcSet, so the Reader serves this as a
   * plain `src` and looks correct. Dimensions are null because nothing reads
   * them: card aspect ratios come from CSS, which is why CLS measures 0.
   */
  private async toLocalDisk(
    source: Buffer,
    id: string,
    kind: { ext: string; mime: string },
  ): Promise<UploadedImage> {
    const key = `media/${id}/original.${kind.ext}`;
    const path = join(this.localDir, key);
    await fs.mkdir(join(path, '..'), { recursive: true });
    await fs.writeFile(path, source);

    return {
      storageKey: `media/${id}`,
      width: null,
      height: null,
      bytes: source.byteLength,
      mimeType: kind.mime,
      variants: { original: `/${key}` },
    };
  }
}
