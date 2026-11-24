import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { type APIRequestContext, type Page, expect, request } from '@playwright/test';
import pg from 'pg';
import { BASE_URL, DATABASE_URL, OWNER } from '../env.js';
import { totp } from './totp.js';

export const STATE_FILE = new URL('../.state/owner.json', import.meta.url);

/** The owner's TOTP secret, written by owner.setup.ts. */
export function ownerSecret(): string {
  return (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { secret: string }).secret;
}

/** Signs in with a password (and the TOTP code when 2FA is on); returns a cookie context. */
export async function signIn(
  email: string,
  password: string,
  secret?: string,
): Promise<APIRequestContext> {
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { origin: BASE_URL, 'x-forwarded-for': clientIp() },
  });
  const res = await ctx.post('/api/auth/sign-in/email', { data: { email, password } });
  expect(res.ok(), await res.text()).toBe(true);
  if ((await res.json()).twoFactorRedirect) {
    if (!secret) throw new Error(`${email} needs a second factor`);
    const verified = await ctx.post('/api/auth/two-factor/verify-totp', {
      data: { code: totp(secret) },
    });
    expect(verified.ok(), await verified.text()).toBe(true);
  }
  return ctx;
}

export const signInOwner = () => signIn(OWNER.email, OWNER.password, ownerSecret());

/** An invitation from the owner into one of their families; returns its id. */
export async function invite(input: {
  email: string;
  locale: string;
  role?: string;
  family?: string;
}) {
  const ctx = await signInOwner();
  try {
    const me = (await (await ctx.get('/api/v1/me')).json()) as {
      families: { id: string; name: string }[];
    };
    const family = me.families.find((f) => f.name === (input.family ?? OWNER.family));
    if (!family) throw new Error(`No family ${input.family}`);
    const active = await ctx.post('/api/auth/organization/set-active', {
      data: { organizationId: family.id },
    });
    expect(active.ok(), await active.text()).toBe(true);
    const res = await ctx.post('/api/auth/organization/invite-member', {
      data: {
        email: input.email,
        role: input.role ?? 'member',
        organizationId: family.id,
        locale: input.locale,
      },
    });
    expect(res.ok(), await res.text()).toBe(true);
    return ((await res.json()) as { id: string }).id;
  } finally {
    await ctx.dispose();
  }
}

/** A member with a password, created from an invitation through the API. */
export async function createMember(
  email: string,
  password: string,
  locale: string,
  role = 'member',
) {
  const id = await invite({ email, locale, role });
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { origin: BASE_URL, 'x-forwarded-for': clientIp() },
  });
  const res = await ctx.post('/api/auth/sign-up/email', {
    data: { email, password, name: 'Пётр', inviteToken: id, locale },
  });
  expect(res.ok(), await res.text()).toBe(true);
  await ctx.dispose();
}

export async function sql(text: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await client.query(text, values);
  } finally {
    await client.end();
  }
}

/**
 * A fresh client IP per context or page. Better Auth's rate limit stays on (3 sign-ins per
 * 10 s per IP); distinct IPs keep unrelated scenarios apart, as Caddy's x-forwarded-for does.
 * Random, not a counter: each spec file loads this module afresh, so a counter would repeat.
 */
export function clientIp(): string {
  const [a, b, c] = randomBytes(3);
  return `10.${a}.${b}.${(c! % 250) + 1}`;
}

let counter = 0;
/** A fresh email per call. */
export function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}@e2e.test`;
}

/**
 * Signs the page's browser context in through the API (cookies land in the context), with
 * the TOTP code when 2FA is on. Faster than the form, which sign-in.spec.ts covers.
 */
export async function signInPage(page: Page, email: string, password: string, secret?: string) {
  const headers = { origin: BASE_URL, 'x-forwarded-for': clientIp() };
  const api = page.context().request;
  const res = await api.post('/api/auth/sign-in/email', { data: { email, password }, headers });
  expect(res.ok(), await res.text()).toBe(true);
  if ((await res.json()).twoFactorRedirect) {
    if (!secret) throw new Error(`${email} needs a second factor`);
    const verified = await api.post('/api/auth/two-factor/verify-totp', {
      data: { code: totp(secret) },
      headers,
    });
    expect(verified.ok(), await verified.text()).toBe(true);
  }
}

const MAILPIT = process.env['MAILPIT_URL']?.trim() || 'http://127.0.0.1:8025';

/** Subjects of the emails Mailpit holds for one address, newest first. */
export async function mailSubjects(to: string): Promise<string[]> {
  const ctx = await request.newContext();
  try {
    const res = await ctx.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"` } });
    expect(res.ok(), await res.text()).toBe(true);
    const body = (await res.json()) as { messages: { Subject: string }[] };
    return body.messages.map((message) => message.Subject);
  } finally {
    await ctx.dispose();
  }
}
