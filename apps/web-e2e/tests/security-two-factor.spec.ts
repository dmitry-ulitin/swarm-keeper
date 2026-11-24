import { createMember, signInPage, uniqueEmail } from '../support/api.js';
import { expect, hook, test } from '../support/fixtures.js';
import { totp } from '../support/totp.js';

test('a new admin turns on 2FA, then may invite', async ({ page, lang }) => {
  const email = uniqueEmail('admin');
  const password = 'admin password 2026';
  await createMember(email, password, lang, 'admin');
  await signInPage(page, email, password);

  await page.goto('/family/members');
  await expect(page.locator(hook('two-factor-note'))).toBeVisible();
  await expect(page.locator(hook('invite'))).toHaveCount(0);

  await page.goto('/settings/security');
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await page.locator(hook('enable-2fa')).click();
  await page.locator(hook('password')).fill(password);
  await page.locator(hook('next')).click();
  const secret = ((await page.locator(hook('secret')).textContent()) ?? '').replace(/\s/g, '');
  expect(secret).toMatch(/^[A-Z2-7]+$/);
  await page.locator(hook('code')).fill(totp(secret));
  await page.locator(hook('confirm')).click();
  await expect(page.locator(hook('backup-code'))).toHaveCount(10);
  await page.locator(hook('done')).click();
  await expect(page.locator(hook('two-factor-on'))).toBeVisible();

  await page.goto('/family/members');
  await expect(page.locator(hook('invite'))).toBeVisible();
  await expect(page.locator(hook('two-factor-note'))).toHaveCount(0);
});
