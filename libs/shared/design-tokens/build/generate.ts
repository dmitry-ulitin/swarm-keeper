// Writes src/tokens.css from docs/design/tokens.json. Run: pnpm tokens:build
import { readFileSync, writeFileSync } from 'node:fs';
import { buildTokensCss } from './tokens-css.ts';

const source = new URL('../../../../docs/design/tokens.json', import.meta.url);
const target = new URL('../src/tokens.css', import.meta.url);
writeFileSync(target, await buildTokensCss(JSON.parse(readFileSync(source, 'utf8'))));
console.log(`wrote ${target.pathname}`);
