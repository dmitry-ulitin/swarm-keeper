import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkI18nParity } from './parity.ts';

function tree(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'i18n-check-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, JSON.stringify(content));
  }
  return root;
}

describe('checkI18nParity', () => {
  it('accepts folders whose en and ru have the same keys', () => {
    const root = tree({
      'en.json': {},
      'ru.json': {},
      'dev/en.json': { title: 'Title', files: { one: 'x' } },
      'dev/ru.json': { title: 'Заголовок', files: { one: 'х' } },
    });
    expect(checkI18nParity(root)).toEqual([]);
  });

  it('reports a nested key missing in ru', () => {
    const root = tree({
      'dev/en.json': { a: { b: 'x' } },
      'dev/ru.json': { a: {} },
    });
    expect(checkI18nParity(root)).toEqual(['dev: "a.b" missing in ru']);
  });

  it('reports a key missing in en', () => {
    const root = tree({ 'en.json': {}, 'ru.json': { extra: 'х' } });
    expect(checkI18nParity(root)).toEqual(['.: "extra" missing in en']);
  });

  it('reports a folder without ru.json', () => {
    const root = tree({ 'dev/en.json': { a: 'x' } });
    expect(checkI18nParity(root)).toEqual(['dev: ru.json missing']);
  });
});
