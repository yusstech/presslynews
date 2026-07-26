import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArticlesModule } from './articles/articles.module';
import { ContentModule } from './content/content.module';
import { SearchModule } from './search/search.module';
import { MediaModule } from './media/media.module';
import { QueueModule } from './queue/queue.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Config lives in one file at the repo root, shared with the worker.
      envFilePath: ['.env', join(process.cwd(), '../../.env')],
    }),
    PrismaModule,
    QueueModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    ContentModule,
    SearchModule,
    MediaModule,
  ],
  providers: [
    // Every route is protected by default; @Public() opts out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
