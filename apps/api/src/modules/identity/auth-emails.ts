import { type OutgoingMail, renderLayout } from '../mail/index.js';
import en from './mail/i18n/en.json' with { type: 'json' };
import ru from './mail/i18n/ru.json' with { type: 'json' };

export type EmailLocale = 'en' | 'ru';

type Texts = typeof en;
const TEXTS: Record<EmailLocale, Texts> = { en, ru };

/** `ru`, `ru-RU`, `RU_ru` → `ru`; anything else, including missing values, → `en`. */
export function emailLocale(value: unknown): EmailLocale {
  if (typeof value !== 'string') {
    return 'en';
  }
  return value.toLowerCase().split(/[-_]/)[0] === 'ru' ? 'ru' : 'en';
}

type Vars = Record<string, string>;

function fill(template: string, vars: Vars): string {
  // One pass, so a name that looks like a placeholder is never expanded.
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

interface Parts {
  subject: string;
  heading: string;
  body: string;
  action: string;
  ignore: string;
  expires?: string;
}

function compose(
  to: string,
  url: string,
  locale: EmailLocale,
  parts: Parts,
  vars: Vars,
): OutgoingMail {
  const t = (s: string) => fill(s, vars);
  const heading = t(parts.heading);
  const paragraphs = [t(parts.body)];
  const notes = [...(parts.expires ? [t(parts.expires)] : []), t(parts.ignore)];
  const footer = TEXTS[locale].footer;
  const action = { label: t(parts.action), url };
  return {
    to,
    // Names are typed by people: no line breaks may reach the header.
    subject: t(parts.subject).replace(/[\r\n]+/g, ' '),
    html: renderLayout({ lang: locale, heading, paragraphs, action, notes, footer }),
    text: [heading, ...paragraphs, `${action.label}: ${url}`, ...notes, footer].join('\n\n') + '\n',
  };
}

export function invitationEmail(input: {
  to: string;
  url: string;
  locale: unknown;
  inviterName: string;
  familyName: string;
  expiresAt: Date;
}): OutgoingMail {
  const locale = emailLocale(input.locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(input.expiresAt);
  return compose(input.to, input.url, locale, TEXTS[locale].invitation, {
    inviter: input.inviterName,
    family: input.familyName,
    date,
  });
}

export function verifyEmailEmail(input: {
  to: string;
  url: string;
  locale: unknown;
}): OutgoingMail {
  const locale = emailLocale(input.locale);
  return compose(input.to, input.url, locale, TEXTS[locale].verifyEmail, {});
}

export function resetPasswordEmail(input: {
  to: string;
  url: string;
  locale: unknown;
}): OutgoingMail {
  const locale = emailLocale(input.locale);
  return compose(input.to, input.url, locale, TEXTS[locale].resetPassword, {});
}
