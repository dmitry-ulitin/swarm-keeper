import { OWNER } from '../env.js';
import {
  createMember,
  invite,
  mailSubjects,
  ownerSecret,
  signInPage,
  sql,
  uniqueEmail,
} from '../support/api.js';
import { type Lang, expect, hook, t, test, text } from '../support/fixtures.js';

const subject = (lang: Lang) =>
  lang === 'ru'
    ? `Приглашение в семью «${OWNER.family}»`
    : `Invitation to the family “${OWNER.family}”`;

/** Rows of the invitations list for one address. */
const invitationRows = (page: import('@playwright/test').Page, email: string) =>
  page.locator(hook('invitation')).filter({ hasText: email });

test.beforeEach(async ({ page }) => {
  await signInPage(page, OWNER.email, OWNER.password, ownerSecret());
});

test('the owner invites, resends and cancels', async ({ page, lang }) => {
  const other: Lang = lang === 'ru' ? 'en' : 'ru';
  const email = uniqueEmail('invited');
  await page.goto('/family/members');
  await page.locator(hook('invite')).click();
  await page.locator(hook('email')).fill(email);
  await page.locator(hook('locale')).selectOption(other);
  await page.locator(hook('send')).click();
  await expect(invitationRows(page, email)).toHaveCount(1);
  await expect.poll(() => mailSubjects(email)).toEqual([subject(other)]);

  await invitationRows(page, email).locator(hook('resend')).click();
  await expect.poll(async () => (await mailSubjects(email)).length).toBe(2);

  await invitationRows(page, email).locator(hook('cancel')).click();
  await page.locator(hook('confirm')).click();
  await expect(invitationRows(page, email)).toHaveCount(0);
});

test('an expired invitation can be sent again', async ({ page, lang }) => {
  const email = uniqueEmail('late');
  const id = await invite({ email, locale: lang });
  await sql(`update invitation set expires_at = now() - interval '1 minute' where id = $1`, [id]);
  const before = (await mailSubjects(email)).length;
  await page.goto('/family/members');
  await expect(invitationRows(page, email).locator(hook('expired'))).toBeVisible();

  await invitationRows(page, email).locator(hook('resend')).click();
  await expect.poll(async () => (await mailSubjects(email)).length).toBe(before + 1);
  await expect(invitationRows(page, email)).toHaveCount(1);
  await expect(invitationRows(page, email).locator(hook('expired'))).toHaveCount(0);
});

test('Change role is not implemented yet', async ({ page }) => {
  const email = uniqueEmail('member');
  await createMember(email, 'member password 2026', 'en');
  await page.goto('/family/members');
  const shown = ((await page.locator('html').getAttribute('lang')) ?? 'en') as Lang;
  const row = page.locator(hook('member')).filter({ hasText: email });
  await row.locator(hook('member-menu')).click();
  await page.locator(hook('change-role')).click();
  await expect(page.locator('[matsnackbarlabel]')).toHaveText(
    t(text(shown, 'family'), 'notImplemented'),
  );
});
