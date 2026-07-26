import { Controller, Get, Param, Query } from '@nestjs/common';
import { ContentService } from './content.service';
import { Public } from '../common/decorators';

/** Public read API backing the Reader. */
@Public()
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Get('home')
  home() {
    return this.content.home();
  }

  @Get('articles')
  list(@Query('limit') limit?: string) {
    return this.content.listPublished(limit ? Number(limit) : undefined);
  }

  @Get('articles/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.content.getBySlug(slug);
  }

  @Get('countries/:code/articles')
  byCountry(@Param('code') code: string) {
    return this.content.byCountry(code);
  }

  @Get('topics/:slug/articles')
  byTopic(@Param('slug') slug: string) {
    return this.content.byTopic(slug);
  }
}
