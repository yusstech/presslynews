import { Module } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { ArticlesController } from './articles.controller';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SearchModule, NotificationsModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
