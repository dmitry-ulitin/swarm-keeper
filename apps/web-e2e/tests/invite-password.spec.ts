import { invite, uniqueEmail } from '../support/api.js';
import { expect, hook, test } from '../support/fixtures.js';

test('an invitee joins with a password, adds a passkey, then signs in with it', async ({
  page,
  lang,
}) => {
  const id = await invite({ email: uniqueEmail('password'), locale: lang });
  await page.goto(`/invite/${id}`);
  await page.locator(hook('show-password')).click();
  await page.locator(hook('name')).fill('Пётр');
  await page.locator(hook('password')).fill('correct horse battery staple');
  await page.locator(hook('submit')).click();
  await page.locator(hook('add-passkey')).click();
  await expect(page).toHaveURL(/\/$/);

  await page.locator(hook('user-menu')).click();
  await page.locator(hook('sign-out')).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.locator(hook('passkey')).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(hook('family'))).toContainText('Ивановы');
});
