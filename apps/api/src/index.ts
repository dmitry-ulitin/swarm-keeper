/** Every API route lives under this prefix; changes within a version are additive only. */
export const API_PREFIX = 'api/v1';

export { AlbumsModule } from './modules/albums/index.js';
export { AssetsModule } from './modules/assets/index.js';
export { AuditModule } from './modules/audit/index.js';
export { DocumentsModule } from './modules/documents/index.js';
export { IdentityModule } from './modules/identity/index.js';
export { JobsModule } from './modules/jobs/index.js';
export { SearchModule } from './modules/search/index.js';
