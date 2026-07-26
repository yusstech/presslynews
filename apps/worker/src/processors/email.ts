import type { Job } from 'bullmq';
import { JOB, type EmailMessage } from '@pressly/jobs';
import { log } from '../context';
import { deliver } from '../email/transport';

export async function processEmailJob(job: Job): Promise<void> {
  if (job.name !== JOB.sendEmail) {
    log.warn(`Unknown email job: ${job.name}`);
    return;
  }
  await deliver(job.data as EmailMessage);
}
