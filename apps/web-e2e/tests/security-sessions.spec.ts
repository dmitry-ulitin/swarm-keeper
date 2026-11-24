import { BASE_URL } from '../env.js';
import { clientIp, createMember, signInPage, uniqueEmail } from '../support/api.js';
import { expect, hook, test } from '../support/fixtures.js';

test('ending another session signs that device out', async ({ page, browser, lang }) => {
  const email = uniqueEmail('sessions');
  const password = 'sessions password 2026';
  await createMember(email, password, lang);
  const other = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'x-forwarded-for': clientIp() },
  });
  const otherPage = await other.newPage();
  try {
    await signInPage(page, email, password);
    await signInPage(otherPage, email, password);

    await page.goto('/settings/security');
    const rows = page.locator(hook('session'));
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator(hook('end-session'))).toHaveCount(0);
    await rows.nth(1).locator(hook('end-session')).click();
    await expect(rows).toHaveCount(1);

    await otherPage.goto('/settings/security');
    await expect(otherPage).toHaveURL(/\/login/);
  } finally {
    await other.close();
  }
});
