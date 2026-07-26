import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  DEFAULT_JOB_OPTIONS,
  QUEUE,
  JOB,
  redisConnection,
  type EmailMessage,
} from '@pressly/jobs';

/** How long an enqueue may take before we give up and work inline. */
const ENQUEUE_TIMEOUT_MS = 2000;

/**
 * Producer side of the job system.
 *
 * Every method reports whether the job was actually queued. Callers use that to
 * decide whether to fall back to doing the work inline — a publish must never
 * fail just because Redis is unreachable, but it also must not silently skip
 * indexing.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  // Producer connection: reject rather than buffer when Redis is unwell.
  private readonly connection = redisConnection(undefined, { failFast: true });
  private readonly queues = new Map<string, Queue>();

  /** False when REDIS_URL is unset — the worker isn't part of this deployment. */
  readonly enabled = this.connection !== null;

  constructor() {
    if (!this.enabled) {
      this.logger.warn('REDIS_URL not set — background jobs will run inline');
    }
  }

  private queueFor(name: string): Queue | null {
    if (!this.connection) return null;
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      // A dead connection must not crash the API process.
      queue.on('error', (err) => this.logger.warn(`Queue ${name} error: ${err.message}`));
      this.queues.set(name, queue);
    }
    return queue;
  }

  private async add(queueName: string, jobName: string, payload: object): Promise<boolean> {
    const queue = this.queueFor(queueName);
    if (!queue) return false;
    try {
      // Belt and braces: even with a fail-fast connection, no editorial action
      // may hang on the queue. Past the deadline we report failure and the
      // caller falls back to inline work.
      await withTimeout(queue.add(jobName, payload), ENQUEUE_TIMEOUT_MS);
      return true;
    } catch (err) {
      this.logger.error(`Failed to enqueue ${jobName}: ${(err as Error).message}`);
      return false;
    }
  }

  /** Fan-out for an article that just became publicly visible. */
  articlePublished(articleId: string) {
    return this.add(QUEUE.articles, JOB.articlePublished, { articleId });
  }

  /** An article left public view — the index and caches need to drop it. */
  articleUnpublished(articleId: string) {
    return this.add(QUEUE.articles, JOB.articleUnpublished, { articleId });
  }

  sendEmail(message: EmailMessage) {
    return this.add(QUEUE.email, JOB.sendEmail, message);
  }

  optimizeMedia(mediaId: string) {
    return this.add(QUEUE.media, JOB.optimizeMedia, { mediaId });
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close().catch(() => undefined)));
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
