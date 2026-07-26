import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@pressly/db';
import {
  canTransition,
  estimateReadingTimeMinutes,
  isPublic,
  type ArticleDoc,
  type ArticleStatus,
} from '@pressly/types';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { QueueService } from '../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/decorators';
import { slugify, randomSuffix } from '../common/slug';
import { CreateArticleDto, UpdateArticleDto } from './dto';
import { roleCanTransition, isPublishTarget } from './workflow';

const listInclude = {
  author: { select: { id: true, name: true, slug: true, role: true } },
  country: true,
  topic: true,
  heroImage: true,
} satisfies Prisma.ArticleInclude;

@Injectable()
export class ArticlesService {
  constructor(
    private prisma: PrismaService,
    private search: SearchService,
    private queue: QueueService,
    private notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateArticleDto) {
    const article = await this.prisma.article.create({
      data: {
        workingTitle: dto.workingTitle,
        headline: dto.workingTitle,
        slug: `${slugify(dto.workingTitle)}-${randomSuffix()}`,
        articleType: dto.articleType ?? 'NEWS',
        primaryLanguage: dto.primaryLanguage ?? 'en',
        status: 'DRAFT',
        authorId: user.id,
        statusEvents: {
          create: { fromStatus: null, toStatus: 'DRAFT', actorId: user.id, version: 1 },
        },
      },
      include: listInclude,
    });
    await this.audit(user.id, 'article.create', article.id);
    return article;
  }

  /** Newsroom list. Journalists see only their own work; others see everything. */
  async listForNewsroom(user: AuthUser, status?: ArticleStatus) {
    const where: Prisma.ArticleWhereInput = {};
    if (status) where.status = status;
    if (user.role === 'JOURNALIST') where.authorId = user.id;
    return this.prisma.article.findMany({
      where,
      include: listInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getForNewsroom(user: AuthUser, id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { ...listInclude, statusEvents: { orderBy: { createdAt: 'desc' } } },
    });
    if (!article) throw new NotFoundException('Article not found');
    if (user.role === 'JOURNALIST' && article.authorId !== user.id) {
      throw new ForbiddenException('You can only view your own articles');
    }
    return article;
  }

  async update(user: AuthUser, id: string, dto: UpdateArticleDto) {
    const existing = await this.getForNewsroom(user, id);

    const data: Prisma.ArticleUpdateInput = {
      headline: dto.headline,
      subheadline: dto.subheadline,
      workingTitle: dto.workingTitle,
      summary: dto.summary,
      articleType: dto.articleType,
      primaryLanguage: dto.primaryLanguage,
      isBreaking: dto.isBreaking,
      homepagePlacement: dto.homepagePlacement,
      seoTitle: dto.seoTitle,
      metaDescription: dto.metaDescription,
      socialHeadline: dto.socialHeadline,
      socialDescription: dto.socialDescription,
    };

    // Publish date. This is both the scheduled time and, once published, the
    // date shown on the article — so editing it on a live story updates the
    // displayed publish date.
    if (dto.publishAt !== undefined) {
      const when = dto.publishAt ? new Date(dto.publishAt) : null;
      data.publishAt = when;
      const isLive =
        existing.status === 'PUBLISHED' ||
        existing.status === 'UPDATED' ||
        existing.status === 'CORRECTED';
      if (when && isLive) data.publishedAt = when;
    }

    if (dto.countryId !== undefined)
      data.country = dto.countryId ? { connect: { id: dto.countryId } } : { disconnect: true };
    if (dto.topicId !== undefined)
      data.topic = dto.topicId ? { connect: { id: dto.topicId } } : { disconnect: true };
    if (dto.heroImageId !== undefined)
      data.heroImage = dto.heroImageId
        ? { connect: { id: dto.heroImageId } }
        : { disconnect: true };

    // A body change snapshots a revision and recomputes reading time.
    if (dto.bodyJson) {
      const doc = dto.bodyJson as unknown as ArticleDoc;
      const version = existing.version + 1;
      data.bodyJson = dto.bodyJson as Prisma.InputJsonValue;
      data.readingTime = estimateReadingTimeMinutes(doc);
      data.version = version;
      data.revisions = {
        create: { bodyJson: dto.bodyJson as Prisma.InputJsonValue, version, editorId: user.id },
      };
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data,
      include: listInclude,
    });
    // Editing a live article should refresh its search document.
    if (isPublic(updated.status)) await this.search.syncArticle(id);
    return updated;
  }

  /** Move an article through the editorial workflow, logging every step. */
  async transition(user: AuthUser, id: string, to: ArticleStatus, comment?: string) {
    const article = await this.getForNewsroom(user, id);
    const from = article.status;

    if (from === to) throw new BadRequestException('Article is already in that state');
    if (!canTransition(from, to)) {
      throw new BadRequestException(`Cannot move from ${from} to ${to}`);
    }
    if (!roleCanTransition(user.role, to)) {
      throw new ForbiddenException(`Your role cannot move an article to ${to}`);
    }
    if (to === 'PUBLISHED' && !article.headline.trim()) {
      throw new BadRequestException('An article needs a headline before publishing');
    }

    const data: Prisma.ArticleUpdateInput = {
      status: to,
      statusEvents: {
        create: {
          fromStatus: from,
          toStatus: to,
          actorId: user.id,
          comment,
          version: article.version,
        },
      },
    };
    // Publishing uses the chosen publish date if set, else now.
    if (to === 'PUBLISHED') {
      data.publishedAt = article.publishedAt ?? article.publishAt ?? new Date();
    }
    if (isPublishTarget(to) && to === 'SCHEDULED' && !article.publishAt) {
      throw new BadRequestException('Set a publish time before scheduling');
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data,
      include: listInclude,
    });
    await this.audit(user.id, `article.transition.${to}`, id, { from });

    await this.fanOut(id, from, to);
    await this.notifications.announceTransition(updated, to, user, comment);

    return updated;
  }

  /**
   * Hand the post-transition work to the worker. The plan is explicit that a
   * publish must not wait on indexing, social images or cache invalidation — so
   * this only enqueues. When Redis is absent the enqueue reports false and we
   * do the one step that would otherwise break the Reader (search) inline.
   */
  private async fanOut(articleId: string, from: ArticleStatus, to: ArticleStatus) {
    // A story moving between draft states was never public, so there is nothing
    // to publish or to tear down — only crossing the public boundary matters.
    if (!isPublic(to) && !isPublic(from)) return;

    const queued = isPublic(to)
      ? await this.queue.articlePublished(articleId)
      : await this.queue.articleUnpublished(articleId);

    if (!queued) await this.search.syncArticle(articleId);
  }

  private audit(actorId: string, action: string, entityId: string, metadata: object = {}) {
    return this.prisma.auditLog.create({
      data: { actorId, action, entity: 'article', entityId, metadata: metadata as Prisma.InputJsonValue },
    });
  }
}
