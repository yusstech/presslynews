import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaxonomyService {
  constructor(private prisma: PrismaService) {}

  countries() {
    return this.prisma.country.findMany({ orderBy: { name: 'asc' } });
  }

  languages() {
    return this.prisma.language.findMany();
  }

  topics() {
    return this.prisma.topic.findMany({ orderBy: { name: 'asc' } });
  }
}
