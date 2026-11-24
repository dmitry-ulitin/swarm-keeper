// Test helpers for the auth feature (not exported from the library).
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
  'auth/en': json('src/i18n/auth/en.json'),
  'auth/ru': json('src/i18n/auth/ru.json'),
};
export const authText = (lang: 'en' | 'ru') =>
  files[`auth/${lang}`] as Record<string, Record<string, string>>;
export const rootText = (lang: 'en' | 'ru') =>
  (files[lang] as { errors: { auth: Record<string, string> } }).errors;

class FileLoader implements TranslocoLoader {
  getTranslation(path: string) {
    return of(files[path] ?? {});
  }
}
export const fileLoader = { provide: TRANSLOCO_LOADER, useClass: FileLoader };

/** A stand-in AuthService: every method is a vi.fn, signals are writable. */
export function fakeAuth(me: MeResponse | null = null) {
  const state = signal<MeResponse | null>(me);
  return {
    state,
    signedIn: () => state() !== null,
    user: () => state()?.user ?? null,
    activeFamily: () => state()?.families.find((f) => f.id === state()?.activeFamilyId) ?? null,
    permissions: () => state()?.permissions ?? [],
    ensureLoaded: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    signInPasskey: vi.fn(async () => undefined),
    signInPassword: vi.fn(async (): Promise<'ok' | 'two-factor'> => 'ok'),
    verifyTotp: vi.fn(async () => undefined),
    verifyBackupCode: vi.fn(async () => undefined),
    signUpPasskey: vi.fn(async () => undefined),
    signUpPassword: vi.fn(async () => undefined),
    acceptInvitation: vi.fn(async () => undefined),
    addPasskey: vi.fn(async () => undefined),
    requestPasswordReset: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
  };
}

export const rejectWith = (code: string) => () => Promise.reject(new AuthError(code));

/** Template text left after removing markup, interpolations and control flow: must be empty. */
export function literalText(path: string): string {
  return (
    readFileSync(path, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/@let\s[^;]*;/g, '')
      .replace(/\{\{[\s\S]*?\}\}/g, '')
      .replace(/<[^>]*>/g, '')
      // Control flow such as @if (a(); as b) {, with one level of nested parentheses.
      .replace(/@[a-z]+\s*(\((?:[^()]|\([^()]*\))*\))?\s*\{/gi, '')
      .replace(/[{}]/g, '')
      .trim()
  );
}

export const ME: MeResponse = {
  user: {
    id: 'u1',
    name: 'Анна',
    email: 'anna@example.test',
    locale: 'ru',
    uiSize: 'compact',
    twoFactorEnabled: false,
    hasPassword: true,
  },
  families: [{ id: 'f1', name: 'Ивановы', role: 'admin' }],
  activeFamilyId: 'f1',
  role: 'admin',
  permissions: [],
  twoFactorRequired: false,
};
