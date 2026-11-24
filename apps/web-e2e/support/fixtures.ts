import { test as base, expect } from '@playwright/test';
import { clientIp } from './api.js';

export type Lang = 'en' | 'ru';

/**
 * `lang` comes from the project (chromium-en / chromium-ru). `authenticator` adds a Chromium
 * virtual WebAuthn authenticator that always verifies the user, so passkeys work headless.
 */
export const test = base.extend<{ lang: Lang; authenticator: void }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures take their dependencies as a pattern
  lang: async ({}, use, testInfo) => {
    await use((testInfo.project.metadata as { lang?: Lang }).lang ?? 'en');
  },
  authenticator: [
    async ({ page }, use) => {
      await page.setExtraHTTPHeaders({ 'x-forwarded-for': clientIp() });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** `[data-test="…"]`. */
export const hook = (name: string) => `[data-test="${name}"]`;
