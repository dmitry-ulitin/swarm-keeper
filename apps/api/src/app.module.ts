import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/index.js';
import { HealthController } from './health/health.controller.js';
import { AlbumsModule } from './modules/albums/index.js';
import { AssetsModule } from './modules/assets/index.js';
import { AuditModule } from './modules/audit/index.js';
import { DocumentsModule } from './modules/documents/index.js';
import { IdentityModule } from './modules/identity/index.js';
import { JobsModule } from './modules/jobs/index.js';
import { SearchModule } from './modules/search/index.js';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    AssetsModule,
    AlbumsModule,
    DocumentsModule,
    SearchModule,
    AuditModule,
    JobsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
