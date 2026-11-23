import { Module } from '@nestjs/common';
import { AssetsModule, DatabaseModule, DocumentsModule, JobsModule } from '@swarm-keeper/api';

/** The API codebase in worker mode: job processing modules only, no HTTP. */
@Module({
  imports: [DatabaseModule, JobsModule, AssetsModule, DocumentsModule],
})
export class WorkerModule {}
