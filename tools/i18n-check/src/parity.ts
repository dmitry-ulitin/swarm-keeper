import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const LANGS = ['en', 'ru'] as const;

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function folders(root: string): string[] {
  const nested = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => folders(join(root, entry.name)));
  return [root, ...nested];
}

/**
 * For every folder under `root` holding an `en.json` or `ru.json`: both files exist and have
 * the same flattened keys. Returns one message per problem, e.g. `dev: "title" missing in ru`.
 */
export function checkI18nParity(root: string): string[] {
  const messages: string[] = [];
  for (const folder of folders(root)) {
    const present = LANGS.filter((lang) => existsSync(join(folder, `${lang}.json`)));
    if (present.length === 0) continue;
    const name = relative(root, folder) || '.';
    const missingFile = LANGS.find((lang) => !present.includes(lang));
    if (missingFile) {
      messages.push(`${name}: ${missingFile}.json missing`);
      continue;
    }
    const [en, ru] = LANGS.map(
      (lang) => new Set(keys(JSON.parse(readFileSync(join(folder, `${lang}.json`), 'utf8')))),
    ) as [Set<string>, Set<string>];
    for (const key of en) if (key && !ru.has(key)) messages.push(`${name}: "${key}" missing in ru`);
    for (const key of ru) if (key && !en.has(key)) messages.push(`${name}: "${key}" missing in en`);
  }
  return messages;
}
