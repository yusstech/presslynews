import { Resend } from 'resend';
import type { EmailMessage } from '@pressly/jobs';
import { log } from '../context';
import { renderEmail } from './templates';

const resendKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'Pressly <no-reply@pressly.example>';
const resend = resendKey ? new Resend(resendKey) : null;

if (!resend) {
  log.warn('RESEND_API_KEY not set — email will be logged instead of sent');
}

/**
 * Delivers one message.
 *
 * Mirrors the media pipeline's local-disk fallback: with no API key configured
 * the mail is rendered and logged rather than sent, so the full workflow is
 * exercisable in development without a provider account.
 */
export async function deliver(message: EmailMessage): Promise<void> {
  const rendered = renderEmail(message);

  if (!resend) {
    log.info(
      `EMAIL (not sent — no provider)\n` +
        `  to:      ${message.to}\n` +
        `  subject: ${rendered.subject}\n` +
        rendered.text
          .split('\n')
          .map((line) => `  | ${line}`)
          .join('\n'),
    );
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: message.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  // Throwing puts the job back on the queue for BullMQ's retry policy.
  if (error) throw new Error(`Resend rejected ${message.template}: ${error.message}`);

  log.info(`Sent ${message.template} to ${message.to}`);
}
