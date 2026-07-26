import { Controller, Get } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';
import { Public } from '../common/decorators';

/** Countries / languages / topics — read reference data. */
@Public()
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private taxonomy: TaxonomyService) {}

  @Get('countries')
  countries() {
    return this.taxonomy.countries();
  }

  @Get('languages')
  languages() {
    return this.taxonomy.languages();
  }

  @Get('topics')
  topics() {
    return this.taxonomy.topics();
  }
}
