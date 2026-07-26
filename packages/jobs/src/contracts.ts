/**
 * The queue contract shared by the API (producer) and the worker (consumer).
 *
 * Both processes import these names and payload types, so a change to a job
 * shape is a compile error on the other side rather than a silent runtime
 * mismatch discovered in production.
 */

export const QUEUE = {
  articles: 'pressly.articles',
  email: 'pressly.email',
  media: 'pressly.media',
} as const;

export const JOB = {
  /** Fan-out triggered when an article becomes publicly visible. */
  articlePublished: 'article.published',
  /** An article left public view (archived, or pulled back to draft). */
  articleUnpublished: 'article.unpublished',
  /** Repeatable sweep that promotes SCHEDULED articles whose time has come. */
  publishDue: 'article.publish-due',
  sendEmail: 'email.send',
  optimizeMedia: 'media.optimize',
} as const;

export interface ArticlePublishedJob {
  articleId: string;
}

export interface ArticleUnpublishedJob {
  articleId: string;
}

export interface OptimizeMediaJob {
  mediaId: string;
}

/** The publish-due sweep needs no payload; it queries for due work itself. */
export type PublishDueJob = Record<string, never>;

/**
 * Transactional email. One discriminated union covers every message Pressly
 * sends, so the worker's renderer must handle each template exhaustively.
 */
export type EmailMessage =
  | {
      template: 'password-reset';
      to: string;
      locale: string;
      name: string;
      resetUrl: string;
      expiresMinutes: number;
    }
  | {
      template: 'password-changed';
      to: string;
      locale: string;
      name: string;
    }
  | {
      template: 'article-submitted';
      to: string;
      locale: string;
      name: string;
      headline: string;
      authorName: string;
      articleUrl: string;
    }
  | {
      template: 'revision-requested';
      to: string;
      locale: string;
      name: string;
      headline: string;
      editorName: string;
      comment?: string;
      articleUrl: string;
    }
  | {
      template: 'article-approved';
      to: string;
      locale: string;
      name: string;
      headline: string;
      editorName: string;
      articleUrl: string;
    }
  | {
      template: 'article-published';
      to: string;
      locale: string;
      name: string;
      headline: string;
      readerUrl: string;
    };

export type EmailTemplate = EmailMessage['template'];
