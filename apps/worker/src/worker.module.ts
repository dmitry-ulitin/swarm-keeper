import { Module } from '@nestjs/common';
import { AssetsModule, DocumentsModule, JobsModule } from '@swarm-keeper/api';

/** The API codebase in worker mode: job processing modules only, no HTTP. */
@Module({
  imports: [JobsModule, AssetsModule, DocumentsModule],
})
export class WorkerModule {}
