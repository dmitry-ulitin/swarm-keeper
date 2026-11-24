import { invite, uniqueEmail } from '../support/api.js';
import { expect, hook, test } from '../support/fixtures.js';

test('an invitee joins with a passkey and stays signed in', async ({ page, lang }) => {
  const id = await invite({ email: uniqueEmail('passkey'), locale: lang });
  await page.goto(`/invite/${id}`);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.locator(hook('title'))).toContainText('Ивановы');
  await page.locator(`${hook('name')}`).fill(lang === 'ru' ? 'Бабушка Валя' : 'Grandma Valya');
  await page.locator(hook('passkey-sign-up')).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(hook('family'))).toContainText('Ивановы');
  await page.reload();
  await expect(page.locator(hook('family'))).toContainText('Ивановы');
});
