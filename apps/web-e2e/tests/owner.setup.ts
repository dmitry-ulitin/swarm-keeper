import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { OWNER } from '../env.js';
import { STATE_FILE, signIn } from '../support/api.js';
import { secretOf, totp } from '../support/totp.js';

/** The seeded owner signs in with a password, so admin actions need 2FA: turn it on once. */
setup('owner has 2FA', async () => {
  const ctx = await signIn(OWNER.email, OWNER.password);
  const enabled = await ctx.post('/api/auth/two-factor/enable', {
    data: { password: OWNER.password },
  });
  expect(enabled.ok(), await enabled.text()).toBe(true);
  const secret = secretOf(((await enabled.json()) as { totpURI: string }).totpURI);
  const verified = await ctx.post('/api/auth/two-factor/verify-totp', {
    data: { code: totp(secret) },
  });
  expect(verified.ok(), await verified.text()).toBe(true);
  await ctx.dispose();
  mkdirSync(new URL('.', STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ secret }));
});
