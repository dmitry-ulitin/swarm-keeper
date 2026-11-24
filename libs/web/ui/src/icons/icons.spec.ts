import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICONS } from './icons';

// ng test runs from apps/web.
const ROOTS = ['src', '../../libs/web'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

const files = ROOTS.flatMap(sources).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

describe('icon registry', () => {
  it('registers every svgIcon used in a template', () => {
    const used = new Set(
      files.flatMap(({ text }) => [...text.matchAll(/svgIcon="([a-z0-9_]+)"/g)].map((m) => m[1]!)),
    );
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((name) => !(name in ICONS))).toEqual([]);
  });

  it('matches icons.json and the package sources (run pnpm icons:build)', () => {
    const names = JSON.parse(readFileSync('../../libs/web/ui/icons.json', 'utf8')) as string[];
    expect(Object.keys(ICONS).sort()).toEqual([...names].sort());
    for (const name of names) {
      const source = readFileSync(
        `../../libs/web/ui/node_modules/@material-symbols/svg-400/rounded/${name}.svg`,
        'utf8',
      ).trim();
      expect(ICONS[name]).toBe(source);
      expect(source.startsWith('<svg')).toBe(true);
    }
  });

  it('leaves no font icons behind', () => {
    expect(files.filter(({ text }) => text.includes('fontIcon=')).map((f) => f.path)).toEqual([]);
  });
});
