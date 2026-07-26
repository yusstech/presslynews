import type { Job } from 'bullmq';
import sharp from 'sharp';
import { JOB, type OptimizeMediaJob } from '@pressly/jobs';
import { log, prisma, storage } from '../context';

/**
 * Second-pass image optimization.
 *
 * The API generates the variants an editor needs to see immediately; the
 * expensive modern formats are derived here so an upload never blocks on them.
 */
export async function processMediaJob(job: Job): Promise<void> {
  if (job.name !== JOB.optimizeMedia) {
    log.warn(`Unknown media job: ${job.name}`);
    return;
  }

  const { mediaId } = job.data as OptimizeMediaJob;
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) {
    log.warn(`media.optimize for missing media ${mediaId}`);
    return;
  }

  const variants = (media.variants ?? {}) as Record<string, string>;
  const source = await loadSource(media.storageKey, variants);
  if (!source) {
    log.warn(`No readable source for media ${mediaId} — skipping optimization`);
    return;
  }

  const width = Math.min(1600, media.width ?? 1600);

  const avif = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .avif({ quality: 55 })
    .toBuffer();

  const updated = {
    ...variants,
    avif: await storage.put(`${media.storageKey}/large.avif`, avif, 'image/avif'),
  };

  await prisma.media.update({
    where: { id: mediaId },
    data: { variants: updated, processingStatus: 'READY' },
  });

  log.info(`Optimized media ${mediaId} (avif)`);
}

async function loadSource(
  storageKey: string,
  variants: Record<string, string>,
): Promise<Buffer | null> {
  for (const name of ['original.jpg', 'original.png', 'original.webp', 'large.jpg']) {
    const local = await storage.getLocal(`${storageKey}/${name}`);
    if (local) return local;
  }

  const url = variants.original ?? variants.large;
  if (!url) return null;

  return fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? Buffer.from(b) : null))
    .catch(() => null);
}
