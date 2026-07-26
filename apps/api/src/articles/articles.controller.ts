import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { ArticleStatus } from '@pressly/types';
import { ArticlesService } from './articles.service';
import { CreateArticleDto, TransitionDto, UpdateArticleDto } from './dto';
import { CurrentUser, Roles, type AuthUser } from '../common/decorators';

/** Newsroom (authenticated) article management. */
@Controller('newsroom/articles')
export class ArticlesController {
  constructor(private articles: ArticlesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('status') status?: ArticleStatus) {
    return this.articles.listForNewsroom(user, status);
  }

  @Post()
  @Roles('JOURNALIST', 'COPY_EDITOR', 'EDITOR')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto) {
    return this.articles.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.getForNewsroom(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articles.update(user, id, dto);
  }

  @Post(':id/transition')
  transition(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.articles.transition(user, id, dto.toStatus, dto.comment);
  }
}
