import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { clientIp } from './api.js';

export type Lang = 'en' | 'ru';

/**
 * `lang` comes from the project (chromium-en / chromium-ru). `authenticator` adds a Chromium
 * virtual WebAuthn authenticator that always verifies the user, so passkeys work headless.
 */

/** The page's virtual authenticator; `replace` swaps it for a fresh, empty one. */
export interface Authenticator {
  replace(): Promise<void>;
}

const AUTHENTICATOR = {
  protocol: 'ctap2',
  transport: 'internal',
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  automaticPresenceSimulation: true,
} as const;

export const test = base.extend<{ lang: Lang; authenticator: Authenticator }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures take their dependencies as a pattern
  lang: async ({}, use, testInfo) => {
    await use((testInfo.project.metadata as { lang?: Lang }).lang ?? 'en');
  },
  authenticator: [
    async ({ page }, use) => {
      await page.setExtraHTTPHeaders({ 'x-forwarded-for': clientIp() });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      const add = async () =>
        (await cdp.send('WebAuthn.addVirtualAuthenticator', { options: AUTHENTICATOR }))
          .authenticatorId;
      let authenticatorId = await add();
      // A second passkey for the same account needs another device: one authenticator
      // refuses a user it already holds a credential for (excludeCredentials).
      await use({
        replace: async () => {
          await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
          authenticatorId = await add();
        },
      });
    },
    { auto: true },
  ],
});

export { expect };

/** `[data-test="…"]`. */
export const hook = (name: string) => `[data-test="${name}"]`;

/** Texts from the web app's translation files, for assertions in the page's language. */
export function text(lang: Lang, scope: 'root' | 'settings' | 'family'): Record<string, unknown> {
  const path = scope === 'root' ? `${lang}.json` : `${scope}/${lang}.json`;
  return JSON.parse(readFileSync(new URL(`../../web/src/i18n/${path}`, import.meta.url), 'utf8'));
}

/** A nested key such as `invitations.resent`. */
export function t(texts: Record<string, unknown>, key: string): string {
  return key
    .split('.')
    .reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], texts) as string;
}
