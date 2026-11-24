import { describe, expect, it } from 'vitest';
import {
  emailLocale,
  invitationEmail,
  resetPasswordEmail,
  verifyEmailEmail,
} from './auth-emails.js';
import en from './mail/i18n/en.json' with { type: 'json' };
import ru from './mail/i18n/ru.json' with { type: 'json' };

const URL_ = 'https://archive.example/invite/0193-abc';
const expiresAt = new Date('2026-12-01T12:00:00Z');

function invite(locale: unknown, familyName = 'Ивановы', inviterName = 'Анна') {
  return invitationEmail({
    to: 'a@example.test',
    url: URL_,
    locale,
    inviterName,
    familyName,
    expiresAt,
  });
}

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value)
    .flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
    .sort();
}

describe('auth email texts', () => {
  it('have the same keys in en and ru', () => {
    expect(keys(ru)).toEqual(keys(en));
  });
});

describe('invitationEmail', () => {
  it('renders in Russian', () => {
    const mail = invite('ru');
    expect(mail.to).toBe('a@example.test');
    expect(mail.subject).toBe('Приглашение в семью «Ивановы»');
    const date = new Intl.DateTimeFormat('ru', { dateStyle: 'long' }).format(expiresAt);
    for (const part of [mail.html, mail.text]) {
      expect(part).toContain('Анна приглашает вас');
      expect(part).toContain('Принять приглашение');
      expect(part).toContain(URL_);
      expect(part).toContain(date);
    }
    expect(mail.html).toContain('lang="ru"');
  });

  it('renders in English', () => {
    const mail = invite('en', 'Ivanovs', 'Anna');
    expect(mail.subject).toBe('Invitation to the family “Ivanovs”');
    expect(mail.text).toContain('Accept invitation');
    expect(mail.text).toContain(
      new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(expiresAt),
    );
    expect(mail.html).toContain('lang="en"');
  });

  it('escapes names in HTML but keeps them as typed in the subject and text', () => {
    const mail = invite('en', '<b>Tom & "Jerry"</b>');
    expect(mail.html).toContain('&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Tom');
    expect(mail.subject).toContain('<b>Tom & "Jerry"</b>');
    expect(mail.text).toContain('<b>Tom & "Jerry"</b>');
  });

  it('does not expand placeholders inside names', () => {
    expect(invite('ru', 'Ивановы', '{family}').text).toContain(
      '{family} приглашает вас в семью «Ивановы»',
    );
  });

  it('keeps line breaks in a name out of the subject', () => {
    expect(invite('en', 'A\r\nBcc: x@y').subject).not.toMatch(/[\r\n]/);
  });
});

describe('emailLocale', () => {
  it.each([
    ['ru', 'ru'],
    ['ru-RU', 'ru'],
    ['RU', 'ru'],
    ['ru_RU', 'ru'],
    [null, 'en'],
    [undefined, 'en'],
    ['de', 'en'],
    [42, 'en'],
  ])('%o → %s', (value, expected) => {
    expect(emailLocale(value)).toBe(expected);
  });
});

describe('verifyEmailEmail and resetPasswordEmail', () => {
  const url = 'https://archive.example/api/auth/x?token=t&callbackURL=/';

  it.each([
    ['en', 'Confirm your email'],
    ['ru', 'Подтвердите email'],
  ])('verification in %s', (locale, subject) => {
    const mail = verifyEmailEmail({ to: 'a@example.test', url, locale });
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain(url);
  });

  it.each([
    ['en', 'Reset your password', 'one hour'],
    ['ru', 'Сброс пароля', 'один час'],
  ])('reset in %s', (locale, subject, expiry) => {
    const mail = resetPasswordEmail({ to: 'a@example.test', url, locale });
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain(url);
    expect(mail.text).toContain(expiry);
  });
});

describe('every email', () => {
  it('has no exclamation marks or unfilled placeholders', () => {
    for (const locale of ['en', 'ru']) {
      const mails = [
        invite(locale),
        verifyEmailEmail({ to: 'a@example.test', url: URL_, locale }),
        resetPasswordEmail({ to: 'a@example.test', url: URL_, locale }),
      ];
      for (const mail of mails) {
        for (const part of [mail.subject, mail.text]) {
          expect(part).not.toContain('!');
          expect(part).not.toContain('{');
        }
      }
    }
  });
});
