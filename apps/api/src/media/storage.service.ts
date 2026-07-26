import { Injectable, Logger } from '@nestjs/common';
import { MediaStorage } from '@pressly/storage';
import { join } from 'path';

/**
 * Nest-facing wrapper around the shared MediaStorage. The worker constructs the
 * same class directly, so derived variants land beside the originals.
 */
@Injectable()
export class StorageService extends MediaStorage {
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    super({ localDir: process.env.MEDIA_LOCAL_DIR ?? join(process.cwd(), 'uploads') });
    if (this.mode === 'local') {
      this.logger.log('R2 not configured — storing media on local disk at /uploads');
    }
  }
}
