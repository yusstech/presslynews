import type { EmailMessage } from '@pressly/jobs';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Email copy. Deliberately plain: Pressly's calm-editorial voice reads better
 * as quiet typography than as a marketing template, and plain markup is what
 * survives every mail client.
 *
 * Only the shell is localized in v1 — staff mail follows the recipient's UI
 * locale for greeting and sign-off, matching the "UI localization only" scope.
 */
export function renderEmail(message: EmailMessage): RenderedEmail {
  switch (message.template) {
    case 'password-reset':
      return shell(message.locale, message.name, {
        subject: 'Reset your Pressly password',
        body: [
          `We received a request to reset your Pressly password.`,
          `This link expires in ${message.expiresMinutes} minutes and can be used once.`,
        ],
        action: { label: 'Choose a new password', url: message.resetUrl },
        footer: `If you didn't ask for this, you can ignore this email — your password stays unchanged.`,
      });

    case 'password-changed':
      return shell(message.locale, message.name, {
        subject: 'Your Pressly password was changed',
        body: [`Your Pressly password has just been changed.`],
        footer: `If this wasn't you, contact your administrator immediately.`,
      });

    case 'article-submitted':
      return shell(message.locale, message.name, {
        subject: `Ready for review: ${message.headline}`,
        body: [
          `${escapeHtml(message.authorName)} submitted a story for review.`,
          quote(message.headline),
        ],
        action: { label: 'Review the story', url: message.articleUrl },
      });

    case 'revision-requested':
      return shell(message.locale, message.name, {
        subject: `Revisions requested: ${message.headline}`,
        body: [
          `${escapeHtml(message.editorName)} asked for revisions on your story.`,
          quote(message.headline),
          ...(message.comment ? [`Their note: “${escapeHtml(message.comment)}”`] : []),
        ],
        action: { label: 'Open in the newsroom', url: message.articleUrl },
      });

    case 'article-approved':
      return shell(message.locale, message.name, {
        subject: `Approved: ${message.headline}`,
        body: [
          `${escapeHtml(message.editorName)} approved your story. It's ready to publish.`,
          quote(message.headline),
        ],
        action: { label: 'Open in the newsroom', url: message.articleUrl },
      });

    case 'article-published':
      return shell(message.locale, message.name, {
        subject: `Published: ${message.headline}`,
        body: [`Your story is live.`, quote(message.headline)],
        action: { label: 'Read it on Pressly', url: message.readerUrl },
      });
  }
}

const GREETING = {
  en: 'Hello',
  ar: 'مرحبا',
  fr: 'Bonjour',
  de: 'Hallo',
} as const;

const SIGNOFF = {
  en: 'The Pressly newsroom',
  ar: 'غرفة أخبار بريسلي',
  fr: 'La rédaction Pressly',
  de: 'Die Pressly-Redaktion',
} as const;

type Locale = keyof typeof GREETING;

interface ShellParts {
  subject: string;
  body: string[];
  action?: { label: string; url: string };
  footer?: string;
}

function shell(locale: string, name: string, parts: ShellParts): RenderedEmail {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const greeting = GREETING[locale as Locale] ?? GREETING.en;
  const signoff = SIGNOFF[locale as Locale] ?? SIGNOFF.en;

  const paragraphs = parts.body
    .map((p) => `<p style="margin:0 0 16px;">${p}</p>`)
    .join('');

  const button = parts.action
    ? `<p style="margin:24px 0;">
         <a href="${parts.action.url}" style="display:inline-block;padding:12px 24px;background:#16213E;color:#FAFAF8;text-decoration:none;font-weight:600;">${escapeHtml(parts.action.label)}</a>
       </p>`
    : '';

  const footer = parts.footer
    ? `<p style="margin:24px 0 0;color:#666666;font-size:14px;">${parts.footer}</p>`
    : '';

  const html = `<div dir="${dir}" style="background:#FAFAF8;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;padding:0 24px;font-family:Inter,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.7;color:#111111;">
    <p style="margin:0 0 24px;font-family:'IBM Plex Mono',monospace;letter-spacing:3px;font-size:13px;color:#666666;">PRESSLY</p>
    <p style="margin:0 0 16px;">${escapeHtml(greeting)} ${escapeHtml(name)},</p>
    ${paragraphs}
    ${button}
    ${footer}
    <p style="margin:32px 0 0;color:#666666;">— ${escapeHtml(signoff)}</p>
  </div>
</div>`;

  const text = [
    `${greeting} ${name},`,
    '',
    ...parts.body.map(stripHtml),
    ...(parts.action ? ['', `${parts.action.label}: ${parts.action.url}`] : []),
    ...(parts.footer ? ['', stripHtml(parts.footer)] : []),
    '',
    `— ${signoff}`,
  ].join('\n');

  return { subject: parts.subject, html, text };
}

function quote(headline: string) {
  return `<strong>${escapeHtml(headline)}</strong>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}
