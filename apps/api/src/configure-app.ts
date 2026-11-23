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

/**
 * Where the API listens: loopback unless HOST says otherwise. Better Auth takes the client IP
 * from x-forwarded-for, so only the reverse proxy in front may reach the API.
 */
export function listenAddress(env: NodeJS.ProcessEnv = process.env): {
  port: number;
  host: string;
} {
  return { port: Number(env['PORT'] || 3000), host: env['HOST'] || '127.0.0.1' };
}
