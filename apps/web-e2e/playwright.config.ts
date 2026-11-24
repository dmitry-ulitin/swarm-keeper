import { defineConfig, devices } from '@playwright/test';
import { API_PORT, BASE_URL, WEB_PORT } from './env.js';

/**
 * End to end against the real API and the web dev server, in English and Russian.
 * Needs `pnpm infra:up`; run with `pnpm e2e`.
 */
export default defineConfig({
  testDir: './tests',
  // One worker: the scenarios share the seeded owner and Better Auth's rate limits.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /owner\.setup\.ts/ },
    {
      name: 'chromium-en',
      dependencies: ['setup'],
      metadata: { lang: 'en' },
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
    {
      name: 'chromium-ru',
      dependencies: ['setup'],
      metadata: { lang: 'ru' },
      use: { ...devices['Desktop Chrome'], locale: 'ru-RU' },
    },
  ],
  webServer: [
    {
      command: 'sh prepare-api.sh',
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `pnpm --filter @swarm-keeper/web exec ng serve --port ${WEB_PORT} --proxy-config ../web-e2e/proxy.e2e.json`,
      url: BASE_URL,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
