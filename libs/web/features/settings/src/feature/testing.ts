// Test helpers for the settings feature (not exported from the library).
import { readFileSync } from 'node:fs';
import { signal } from '@angular/core';
import { TRANSLOCO_LOADER, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { AuthError, type MeResponse } from '@swarm-keeper/web-core';
import { of } from 'rxjs';
import { vi } from 'vitest';

// ng test runs from apps/web.
const json = (path: string): Translation => JSON.parse(readFileSync(path, 'utf8'));
const files: Record<string, Translation> = {
  en: json('src/i18n/en.json'),
  ru: json('src/i18n/ru.json'),
  'settings/en': json('src/i18n/settings/en.json'),
  'settings/ru': json('src/i18n/settings/ru.json'),
};
export const settingsText = (lang: 'en' | 'ru') =>
  files[`settings/${lang}`] as Record<string, Record<string, string>>;
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
    id: 'u1',
    name: 'Дмитрий',
    email: 'owner@example.test',
    locale: 'ru',
    uiSize: 'compact',
    twoFactorEnabled: false,
    hasPassword: true,
  },
  families: [{ id: 'f1', name: 'Ивановы', role: 'owner' }],
  activeFamilyId: 'f1',
  role: 'owner',
  permissions: ['member:create'],
  twoFactorRequired: true,
};

/** A stand-in AuthService: every method is a vi.fn, signals are writable. */
export function fakeAuth(me: MeResponse = ME) {
  const state = signal<MeResponse | null>(me);
  return {
    state,
    user: () => state()?.user ?? null,
    role: () => state()?.role ?? null,
    refresh: vi.fn(async () => undefined),
    listPasskeys: vi.fn(async () => [
      { id: 'p1', name: 'MacBook', createdAt: '2026-11-23T10:00:00.000Z' },
    ]),
    addPasskey: vi.fn(async (name?: string) => void name),
    renamePasskey: vi.fn(async () => undefined),
    deletePasskey: vi.fn(async () => undefined),
    startTwoFactor: vi.fn(async () => ({
      totpURI: 'otpauth://totp/Swarm%20Keeper:x?secret=JBSWY3DPEHPK3PXP&issuer=Swarm%20Keeper',
      backupCodes: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'],
    })),
    confirmTwoFactor: vi.fn(async () => undefined),
    newBackupCodes: vi.fn(async () => ['n1', 'n2']),
    disableTwoFactor: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
}

export const rejectWith = (code: string) => () => Promise.reject(new AuthError(code));

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

export const FEATURE = '../../libs/web/features/settings/src/feature';
