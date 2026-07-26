import { Controller, Get, Post, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { Public, Roles } from '../common/decorators';

@Controller('search')
export class SearchController {
  constructor(private search: SearchService) {}

  /** Public search backing the ⌘K palette and the /search page. */
  @Public()
  @Get()
  query(
    @Query('q') q = '',
    @Query('country') country?: string,
    @Query('topic') topic?: string,
    @Query('language') language?: string,
    @Query('type') type?: string,
  ) {
    return this.search.search(q, { country, topic, language, type });
  }

  /** Rebuild the whole index (admin). */
  @Roles('SUPER_ADMIN')
  @Post('reindex')
  async reindex() {
    const count = await this.search.reindexAll();
    return { reindexed: count };
  }
}
