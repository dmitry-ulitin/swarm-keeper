import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from './index.js';

/**
 * Settings shared by main.ts and tests. Create the app with `{ bodyParser: false }`:
 * Better Auth reads raw request bodies, and the auth module re-adds the parsers for other routes.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  return app;
}
