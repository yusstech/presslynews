import { Worker, type Job } from 'bullmq';
import { JOB, QUEUE } from '@pressly/jobs';
import { log, prisma, searchIndex } from './context';
import { connection, producerQueues } from './queues';
import { processArticleJob } from './processors/articles';
import { processEmailJob } from './processors/email';
import { processMediaJob } from './processors/media';

/** How often to look for scheduled articles that are due to go live. */
const PUBLISH_SWEEP_MS = 60_000;

async function bootstrap() {
  await searchIndex.ensureIndex().catch((err) => {
    log.warn(`Meilisearch unavailable at startup: ${err.message}`);
  });

  const workers = [
    new Worker(QUEUE.articles, processArticleJob, { connection, concurrency: 4 }),
    new Worker(QUEUE.email, processEmailJob, { connection, concurrency: 8 }),
    // Image work is CPU-bound; keep it from starving the rest.
    new Worker(QUEUE.media, processMediaJob, { connection, concurrency: 2 }),
  ];

  for (const worker of workers) {
    worker.on('failed', (job: Job | undefined, err: Error) => {
      log.error(`${worker.name}/${job?.name} failed (attempt ${job?.attemptsMade}): ${err.message}`);
    });
    worker.on('error', (err) => log.error(`${worker.name} worker error: ${err.message}`));
  }

  // The scheduling sweep. A fixed job id means restarting the worker replaces
  // the repeatable job rather than stacking up duplicates.
  const [articlesQueue] = producerQueues;
  await articlesQueue!.add(
    JOB.publishDue,
    {},
    {
      repeat: { every: PUBLISH_SWEEP_MS },
      jobId: 'publish-due-sweep',
      removeOnComplete: true,
    },
  );

  log.info(`Ready — watching ${workers.map((w) => w.name).join(', ')}`);

  const shutdown = async (signal: string) => {
    log.info(`${signal} received — finishing in-flight jobs`);
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(producerQueues.map((q) => q.close()));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  log.error(`Worker failed to start: ${err.message}`);
  process.exit(1);
});
