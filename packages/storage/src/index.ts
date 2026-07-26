import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface MediaStorageOptions {
  /**
   * Where the local-disk fallback writes. Both the API (which serves /uploads)
   * and the worker (which writes derived variants) must point at the same
   * directory, so each process passes its own resolved path.
   */
  localDir: string;
}

/**
 * Storage abstraction. Uses Cloudflare R2 (S3-compatible) when configured;
 * otherwise falls back to local disk served at /uploads — so media works in dev
 * without any cloud credentials. Production just sets the R2_* env vars.
 *
 * Framework-free on purpose: the API wraps it in an @Injectable() and the BullMQ
 * worker constructs it directly.
 */
export class MediaStorage {
  readonly mode: 'r2' | 'local';
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly r2PublicUrl?: string;
  private readonly localDir: string;

  constructor(options: MediaStorageOptions) {
    this.localDir = options.localDir;

    const hasR2 =
      !!process.env.R2_ACCOUNT_ID &&
      !!process.env.R2_ACCESS_KEY_ID &&
      !!process.env.R2_SECRET_ACCESS_KEY;

    if (hasR2) {
      this.mode = 'r2';
      this.bucket = process.env.R2_BUCKET;
      this.r2PublicUrl = process.env.R2_PUBLIC_URL;
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    } else {
      this.mode = 'local';
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.mode === 'r2') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } else {
      const path = join(this.localDir, key);
      await fs.mkdir(join(path, '..'), { recursive: true });
      await fs.writeFile(path, body);
    }
    return this.url(key);
  }

  /** Reads an object back — the worker needs the original to derive variants. */
  async getLocal(key: string): Promise<Buffer | null> {
    if (this.mode !== 'local') return null;
    return fs.readFile(join(this.localDir, key)).catch(() => null);
  }

  url(key: string): string {
    if (this.mode === 'r2') return `${this.r2PublicUrl}/${key}`;
    const base = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
    return `${base}/uploads/${key}`;
  }
}
