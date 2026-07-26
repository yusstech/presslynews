import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

/** Global so any module can enqueue without re-importing. */
@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
