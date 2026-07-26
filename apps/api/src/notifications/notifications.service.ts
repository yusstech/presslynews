import { Injectable, Logger } from '@nestjs/common';
import type { EmailMessage } from '@pressly/jobs';
import type { ArticleStatus } from '@pressly/types';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

/**
 * Shape the notifier needs from the article being moved. Contact details are
 * looked up here rather than joined into the caller's response, so staff email
 * addresses never leak into general newsroom payloads.
 */
interface NotifiableArticle {
  id: string;
  headline: string;
  authorId: string | null;
}

interface Recipient {
  name: string;
  email: string;
  locale: string;
}

/**
 * Turns editorial workflow transitions into queued email.
 *
 * Nothing here sends mail directly — every message is enqueued, so a slow or
 * failing mail provider can never slow down or fail an editor's action.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private queue: QueueService,
  ) {}

  private get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  }

  private newsroomUrl(articleId: string, locale: string) {
    return `${this.siteUrl}/${locale}/newsroom/articles/${articleId}`;
  }

  /**
   * Announce a transition. Publication confirmation is deliberately absent:
   * the worker sends it as part of the article.published fan-out, once the
   * story is actually live and indexed.
   */
  async announceTransition(
    article: NotifiableArticle,
    to: ArticleStatus,
    actor: { name: string },
    comment?: string,
  ) {
    try {
      switch (to) {
        case 'IN_REVIEW':
          return await this.notifyEditors(article, actor);
        case 'REVISION_REQUESTED':
          return await this.notifyAuthor(article, (author) => ({
            template: 'revision-requested',
            to: author.email,
            locale: author.locale,
            name: author.name,
            headline: article.headline,
            editorName: actor.name,
            comment,
            articleUrl: this.newsroomUrl(article.id, author.locale),
          }));
        case 'READY_TO_PUBLISH':
          return await this.notifyAuthor(article, (author) => ({
            template: 'article-approved',
            to: author.email,
            locale: author.locale,
            name: author.name,
            headline: article.headline,
            editorName: actor.name,
            articleUrl: this.newsroomUrl(article.id, author.locale),
          }));
        default:
          return;
      }
    } catch (err) {
      // A notification failure must never roll back an editorial action.
      this.logger.error(`Failed to queue notifications for ${to}: ${(err as Error).message}`);
    }
  }

  /** A submitted story goes to everyone who can act on it. */
  private async notifyEditors(article: NotifiableArticle, actor: { name: string }) {
    const editors = await this.prisma.user.findMany({
      where: { role: { in: ['EDITOR', 'SUPER_ADMIN'] }, active: true },
      select: { name: true, email: true, locale: true },
    });

    await Promise.all(
      editors.map((editor) =>
        this.queue.sendEmail({
          template: 'article-submitted',
          to: editor.email,
          locale: editor.locale,
          name: editor.name,
          headline: article.headline,
          authorName: actor.name,
          articleUrl: this.newsroomUrl(article.id, editor.locale),
        }),
      ),
    );
  }

  private async notifyAuthor(
    article: NotifiableArticle,
    build: (author: Recipient) => EmailMessage,
  ) {
    if (!article.authorId) return;
    const author = await this.prisma.user.findUnique({
      where: { id: article.authorId },
      select: { name: true, email: true, locale: true },
    });
    if (!author) return;
    await this.queue.sendEmail(build(author));
  }

  /** Password reset and other account mail. */
  passwordReset(user: { name: string; email: string; locale: string }, token: string, expiresMinutes: number) {
    return this.queue.sendEmail({
      template: 'password-reset',
      to: user.email,
      locale: user.locale,
      name: user.name,
      resetUrl: `${this.siteUrl}/${user.locale}/newsroom/reset-password?token=${token}`,
      expiresMinutes,
    });
  }

  passwordChanged(user: { name: string; email: string; locale: string }) {
    return this.queue.sendEmail({
      template: 'password-changed',
      to: user.email,
      locale: user.locale,
      name: user.name,
    });
  }
}
