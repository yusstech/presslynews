import type { Job } from 'bullmq';
import {
  JOB,
  type ArticlePublishedJob,
  type ArticleUnpublishedJob,
  type EmailMessage,
} from '@pressly/jobs';
import { isPublic, type ArticleStatus } from '@pressly/types';
import { log, prisma, searchIndex, siteUrl, storage } from '../context';
import { enqueueArticlePublished, enqueueEmail } from '../queues';
import { renderSocialCard } from '../lib/social-image';
import { revalidateArticle } from '../lib/revalidate';

const fanOutInclude = {
  author: { select: { name: true, email: true, locale: true } },
  country: true,
  topic: true,
  heroImage: true,
} as const;

/**
 * The article queue.
 *
 * Everything a publish should not wait on lives here. Each step is guarded so
 * that one failing side-effect (say, a social card) cannot stop the others —
 * but a failed step still throws at the end so BullMQ retries the job.
 */
export async function processArticleJob(job: Job): Promise<void> {
  switch (job.name) {
    case JOB.articlePublished:
      return onPublished(job.data as ArticlePublishedJob);
    case JOB.articleUnpublished:
      return onUnpublished(job.data as ArticleUnpublishedJob);
    case JOB.publishDue:
      return publishDue();
    default:
      log.warn(`Unknown article job: ${job.name}`);
  }
}

async function onPublished({ articleId }: ArticlePublishedJob) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: fanOutInclude,
  });
  if (!article) {
    log.warn(`article.published for missing article ${articleId}`);
    return;
  }

  // Status may have moved on between enqueue and pickup.
  if (!isPublic(article.status as ArticleStatus)) {
    log.info(`${article.slug} is no longer public — removing from index instead`);
    await searchIndex.remove(articleId);
    return;
  }

  const failures: string[] = [];

  await step(failures, 'search', () => searchIndex.upsert([article]));

  await step(failures, 'social-image', async () => {
    const url = await buildSocialCard(article);
    if (url) {
      await prisma.article.update({ where: { id: articleId }, data: { socialImageUrl: url } });
    }
  });

  await step(failures, 'revalidate', () => revalidateArticle(article.slug));

  await step(failures, 'publication-email', async () => {
    if (!article.author) return;
    const message: EmailMessage = {
      template: 'article-published',
      to: article.author.email,
      locale: article.author.locale,
      name: article.author.name,
      headline: article.headline,
      readerUrl: `${siteUrl()}/${article.primaryLanguage}/article/${article.slug}`,
    };
    // Queued rather than sent here so delivery retries independently of
    // fan-out; the dedupe key stops a fan-out retry mailing the author twice.
    // BullMQ reserves ":" in job ids — it is the Redis key separator.
    await enqueueEmail(message, `published-email-${articleId}`);
  });

  log.info(`Fan-out complete for ${article.slug}`);
  if (failures.length) {
    throw new Error(`Fan-out steps failed for ${article.slug}: ${failures.join(', ')}`);
  }
}

async function onUnpublished({ articleId }: ArticleUnpublishedJob) {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { slug: true, status: true },
  });

  await searchIndex.remove(articleId);
  if (article) await revalidateArticle(article.slug).catch((err) => log.warn(err.message));
  log.info(`Removed ${articleId} from public surfaces`);
}

/**
 * Promotes SCHEDULED articles whose publish time has arrived. Runs on a
 * repeatable job — this is what makes scheduling actually go live.
 */
async function publishDue() {
  const due = await prisma.article.findMany({
    where: { status: 'SCHEDULED', publishAt: { lte: new Date() } },
    select: { id: true, slug: true, publishAt: true, version: true },
  });
  if (due.length === 0) return;

  for (const article of due) {
    await prisma.article.update({
      where: { id: article.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: article.publishAt ?? new Date(),
        statusEvents: {
          create: {
            fromStatus: 'SCHEDULED',
            toStatus: 'PUBLISHED',
            comment: 'Published automatically at its scheduled time',
            version: article.version,
          },
        },
      },
    });
    await enqueueArticlePublished(article.id);
    log.info(`Scheduled publish released: ${article.slug}`);
  }
}

async function buildSocialCard(article: {
  id: string;
  headline: string;
  readingTime: number;
  country: { name: string } | null;
  topic: { name: string } | null;
  heroImage: { storageKey: string; variants: unknown } | null;
}): Promise<string | null> {
  let hero: Buffer | null = null;
  if (article.heroImage) {
    // Only the local fallback can be read back directly; with R2 the public
    // URL is fetched instead.
    hero = await storage.getLocal(`${article.heroImage.storageKey}/large.jpg`);
    if (!hero) {
      const variants = article.heroImage.variants as Record<string, string> | null;
      const url = variants?.large ?? variants?.original;
      if (url) {
        hero = await fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((b) => (b ? Buffer.from(b) : null))
          .catch(() => null);
      }
    }
  }

  const png = await renderSocialCard({
    headline: article.headline,
    kicker: article.country?.name ?? article.topic?.name ?? null,
    readingTime: article.readingTime,
    heroImage: hero,
  });

  return storage.put(`media/social/${article.id}.png`, png, 'image/png');
}

/** Runs a fan-out step, recording rather than propagating its failure. */
async function step(failures: string[], name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    failures.push(name);
    log.error(`Fan-out step "${name}" failed: ${(err as Error).message}`);
  }
}
