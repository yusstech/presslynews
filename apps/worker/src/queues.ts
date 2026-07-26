import { Queue, type ConnectionOptions } from 'bullmq';
import {
  DEFAULT_JOB_OPTIONS,
  JOB,
  QUEUE,
  redisConnection,
  type EmailMessage,
} from '@pressly/jobs';

const configured = redisConnection();

// Unlike the API, the worker has no meaningful degraded mode: without Redis
// there is nothing for it to do, so failing fast is the honest behaviour.
if (!configured) {
  throw new Error('REDIS_URL is required to run the Pressly worker');
}

const connection: ConnectionOptions = configured;

/** The worker is a producer too: fan-out spawns email, scheduling spawns fan-out. */
const articles = new Queue(QUEUE.articles, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
const email = new Queue(QUEUE.email, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });

export function enqueueArticlePublished(articleId: string) {
  return articles.add(JOB.articlePublished, { articleId });
}

/**
 * `dedupeKey` becomes the BullMQ job id, which makes the enqueue idempotent.
 * Fan-out retries would otherwise send a second copy of a publication email.
 */
export function enqueueEmail(message: EmailMessage, dedupeKey?: string) {
  return email.add(JOB.sendEmail, message, dedupeKey ? { jobId: dedupeKey } : undefined);
}

export const producerQueues = [articles, email];
export { connection };
