import { invite, uniqueEmail } from '../support/api.js';
import { expect, hook, t, test, text } from '../support/fixtures.js';

test('a passkey-only member adds, renames and deletes passkeys but keeps the last', async ({
  page,
  lang,
  authenticator,
}) => {
  const id = await invite({ email: uniqueEmail('keys'), locale: lang });
  await page.goto(`/invite/${id}`);
  await page.locator(hook('name')).fill(lang === 'ru' ? 'Валя' : 'Valya');
  await page.locator(hook('passkey-sign-up')).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/settings/security');
  await expect(page.locator(hook('two-factor'))).toHaveCount(0);
  const keys = page.locator(hook('passkey'));
  await expect(keys).toHaveCount(1);

  await authenticator.replace();
  await page.locator(hook('add-passkey')).click();
  await expect(keys).toHaveCount(2);

  await keys.nth(1).locator(hook('rename-passkey')).click();
  await page.locator(hook('name')).fill('Phone');
  await page.locator(hook('save')).click();
  await expect(keys.nth(1)).toContainText('Phone');

  await keys.nth(1).locator(hook('delete-passkey')).click();
  await page.locator(hook('confirm')).click();
  await expect(keys).toHaveCount(1);

  await keys.first().locator(hook('delete-passkey')).click();
  await page.locator(hook('confirm')).click();
  const errors = text(lang, 'root');
  await expect(page.locator('[matsnackbarlabel]')).toHaveText(
    t(errors, 'errors.auth.LAST_SIGN_IN_METHOD'),
  );
  await expect(keys).toHaveCount(1);
});
