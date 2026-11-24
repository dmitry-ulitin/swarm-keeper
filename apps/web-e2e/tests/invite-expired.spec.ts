import { invite, sql, uniqueEmail } from '../support/api.js';
import { expect, hook, test } from '../support/fixtures.js';

test('an expired invitation says the link no longer works', async ({ page, lang }) => {
  const id = await invite({ email: uniqueEmail('expired'), locale: lang });
  await sql(`update invitation set expires_at = now() - interval '1 minute' where id = $1`, [id]);
  await page.goto(`/invite/${id}`);
  await expect(page.locator(hook('invalid'))).toBeVisible();
  await expect(page.locator(hook('sign-in-existing'))).toBeVisible();
});
