import { OWNER } from '../env.js';
import { ownerSecret } from '../support/api.js';
import { totp } from '../support/totp.js';
import { expect, hook, test } from '../support/fixtures.js';

test('the owner signs in with a password and a TOTP code', async ({ page, lang }) => {
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await page.locator(hook('show-password')).click();
  await page.locator(hook('email')).fill(OWNER.email);
  await page.locator(hook('password')).fill(OWNER.password);
  await page.locator(hook('submit')).click();
  await page.locator(hook('code')).fill(totp(ownerSecret()));
  await page.locator(hook('submit')).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(hook('family'))).toBeVisible();
});

test('a wrong password shows the error box', async ({ page }) => {
  await page.goto('/login');
  await page.locator(hook('show-password')).click();
  await page.locator(hook('email')).fill(OWNER.email);
  await page.locator(hook('password')).fill('not the password at all');
  await page.locator(hook('submit')).click();
  await expect(page.locator(hook('error'))).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
