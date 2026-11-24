import { SECOND_FAMILY } from '../env.js';
import { createMember, invite, uniqueEmail } from '../support/api.js';
import { expect, hook, test } from '../support/fixtures.js';

test('a member of one family accepts an invitation to a second', async ({ page, lang }) => {
  const email = uniqueEmail('second');
  const password = 'correct horse battery staple';
  await createMember(email, password, lang);
  const id = await invite({ email, locale: lang, family: SECOND_FAMILY });

  await page.goto(`/invite/${id}`);
  await page.locator(hook('sign-in-to-accept')).click();
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await page.locator(hook('show-password')).click();
  await page.locator(hook('email')).fill(email);
  await page.locator(hook('password')).fill(password);
  await page.locator(hook('submit')).click();
  await expect(page).toHaveURL(new RegExp(`/invite/${id}$`));
  await page.locator(hook('accept')).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(hook('family'))).toContainText(SECOND_FAMILY);

  const me = (await (await page.request.get('/api/v1/me')).json()) as {
    families: { name: string }[];
  };
  expect(me.families.map((f) => f.name).sort()).toEqual([SECOND_FAMILY, 'Ивановы'].sort());
});
