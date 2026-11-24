// Fails when a translation folder's en.json and ru.json differ in keys.
// Usage: node src/cli.ts <i18n root>...
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkI18nParity } from './parity.ts';

const roots = process.argv.slice(2).map((root) => resolve(root));
const messages = roots.filter((root) => existsSync(root)).flatMap((root) => checkI18nParity(root));
for (const message of messages) console.error(`i18n: ${message}`);
if (messages.length > 0) process.exit(1);
console.log(`i18n: en and ru match in ${roots.length} root(s)`);
