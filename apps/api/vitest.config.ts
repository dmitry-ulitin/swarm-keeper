import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
// Not the barrel: it pulls in Nest decorators, which the config bundler cannot parse.
// eslint-disable-next-line @sheriff-arch/sheriff/encapsulation
import { databaseOwnerUrl, databaseUrl, testDatabaseUrl } from './src/database/database-url.js';

// SWC emits the decorator metadata Nest's DI needs; esbuild does not.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.spec.ts'],
    // Tests share one database, recreated and migrated by the global setup as the owner;
    // tests connect as the application role, like the API.
    env: {
      DATABASE_URL: testDatabaseUrl(databaseUrl()),
      DATABASE_OWNER_URL: testDatabaseUrl(databaseOwnerUrl()),
    },
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
  },
});
