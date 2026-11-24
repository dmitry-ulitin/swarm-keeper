// Test helpers for the family feature (not exported from the library).
import { readFileSync } from 'node:fs';
import { signal } from '@angular/core';
import { TRANSLOCO_LOADER, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import type { InvitationRow, MeResponse, MemberView } from '@swarm-keeper/web-core';
import { of } from 'rxjs';
import { vi } from 'vitest';

// ng test runs from apps/web.
const json = (path: string): Translation => JSON.parse(readFileSync(path, 'utf8'));
const files: Record<string, Translation> = {
  en: json('src/i18n/en.json'),
  ru: json('src/i18n/ru.json'),
  'family/en': json('src/i18n/family/en.json'),
  'family/ru': json('src/i18n/family/ru.json'),
};
export const familyText = (lang: 'en' | 'ru') =>
  files[`family/${lang}`] as {
    notImplemented: string;
    invitations: Record<string, string>;
  };
export const errorText = (lang: 'en' | 'ru') =>
  (files[lang] as { errors: { auth: Record<string, string> } }).errors.auth;

class FileLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(files[path] ?? {});
  }
}
export const fileLoader = { provide: TRANSLOCO_LOADER, useClass: FileLoader };

export const ME: MeResponse = {
  user: {
    id: 'u-owner',
    name: 'Дмитрий',
    email: 'owner@example.test',
    locale: 'ru',
    uiSize: 'compact',
    twoFactorEnabled: true,
    hasPassword: true,
  },
  families: [{ id: 'f1', name: 'Ивановы', role: 'owner' }],
  activeFamilyId: 'f1',
  role: 'owner',
  permissions: ['member:create', 'invitation:create', 'invitation:cancel'],
  twoFactorRequired: false,
};

export const MEMBERS: MemberView[] = [
  {
    id: 'm1',
    userId: 'u-owner',
    role: 'owner',
    createdAt: '2026-11-23T10:00:00.000Z',
    user: { name: 'Дмитрий', email: 'owner@example.test' },
  },
  {
    id: 'm2',
    userId: 'u-anna',
    role: 'member',
    createdAt: '2026-11-24T10:00:00.000Z',
    user: { name: 'Анна', email: 'anna@example.test' },
  },
];

const day = 86_400_000;
export const INVITATIONS: InvitationRow[] = [
  {
    id: 'i-valid',
    email: 'bob@example.test',
    role: 'member',
    status: 'pending',
    expiresAt: new Date(Date.now() + 7 * day).toISOString(),
    locale: 'en',
  },
  {
    id: 'i-expired',
    email: 'late@example.test',
    role: 'viewer',
    status: 'pending',
    expiresAt: new Date(Date.now() - day).toISOString(),
    locale: 'ru',
  },
  {
    id: 'i-accepted',
    email: 'anna@example.test',
    role: 'member',
    status: 'accepted',
    expiresAt: new Date(Date.now() + day).toISOString(),
    locale: 'ru',
  },
];

/** A stand-in AuthService: every method is a vi.fn, signals are writable. */
export function fakeAuth(me: MeResponse = ME) {
  const state = signal<MeResponse | null>(me);
  return {
    state,
    user: () => state()?.user ?? null,
    role: () => state()?.role ?? null,
    activeFamily: () => state()?.families.find((f) => f.id === state()?.activeFamilyId) ?? null,
    permissions: () => state()?.permissions ?? [],
    twoFactorRequired: () => state()?.twoFactorRequired ?? false,
    listMembers: vi.fn(async () => MEMBERS),
    listInvitations: vi.fn(async () => INVITATIONS),
    invite: vi.fn(async (input: { email: string; role: string; locale: string }) => void input),
    resendInvitation: vi.fn(async (row: InvitationRow) => void row),
    cancelInvitation: vi.fn(async (id: string) => void id),
  };
}

/** Template text left after removing markup, interpolations and control flow: must be empty. */
export function literalText(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/@let\s[^;]*;/g, '')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/@[a-z]+\s*(\((?:[^()]|\([^()]*\))*\))?\s*\{/gi, '')
    .replace(/[{}]/g, '')
    .trim();
}

export const FEATURE = '../../libs/web/features/family/src/feature';
