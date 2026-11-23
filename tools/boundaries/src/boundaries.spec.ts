import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Lints a hypothetical import placed in a real file, so Sheriff applies the repo's rules.
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

async function sheriffErrors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId?.startsWith('@sheriff-arch/sheriff/'))
    .map((m) => m.message);
}

describe('module boundaries', () => {
  const forbidden: [string, string, string][] = [
    ['web app → api', 'apps/web/src/app/app.config.ts', "export * from '@swarm-keeper/api';"],
    ['worker → web', 'apps/worker/src/worker.module.ts', "export * from '@swarm-keeper/web-core';"],
    ['api → web', 'apps/api/src/app.module.ts', "export * from '@swarm-keeper/web-core';"],
    [
      'web app → feature internals',
      'apps/web/src/app/app.config.ts',
      "export * from '../../../../libs/web/features/gallery/src/data-access/index';",
    ],
    [
      'feature → another feature',
      'libs/web/features/documents/src/feature/index.ts',
      "export * from '@swarm-keeper/feature-gallery';",
    ],
    [
      'api module → internals of another module',
      'apps/api/src/modules/identity/identity.module.ts',
      "export * from '../assets/assets.module.js';",
    ],
    [
      'feature ui → its data-access',
      'libs/web/features/gallery/src/ui/index.ts',
      "export * from '../data-access/index';",
    ],
    [
      'shared → web',
      'libs/shared/permissions/src/index.ts',
      "export * from '@swarm-keeper/web-core';",
    ],
  ];

  it.each(forbidden)('rejects %s', async (_name, file, code) => {
    expect(await sheriffErrors(file, code)).not.toEqual([]);
  });

  const allowed: [string, string, string][] = [
    [
      'web app → web-core',
      'apps/web/src/app/app.config.ts',
      "export * from '@swarm-keeper/web-core';",
    ],
    [
      'web app → feature public API',
      'apps/web/src/app/app.config.ts',
      "export * from '@swarm-keeper/feature-gallery';",
    ],
    ['worker → api', 'apps/worker/src/worker.module.ts', "export * from '@swarm-keeper/api';"],
    [
      'feature page → its data-access',
      'libs/web/features/gallery/src/feature/index.ts',
      "export * from '../data-access/index';",
    ],
    [
      'api module → another module barrel',
      'apps/api/src/modules/identity/identity.module.ts',
      "export * from '../assets/index.js';",
    ],
  ];

  it.each(allowed)('allows %s', async (_name, file, code) => {
    expect(await sheriffErrors(file, code)).toEqual([]);
  });
});
