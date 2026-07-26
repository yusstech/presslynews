import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';

@Module({
  controllers: [ContentController, TaxonomyController],
  providers: [ContentService, TaxonomyService],
})
export class ContentModule {}
