import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The security tests must never be switched off quietly: lint fails on skipped or focused tests.
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

async function restricted(filePath: string, code: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-syntax').length;
}

describe('skipped tests', () => {
  const cases: [string, string][] = [
    ['apps/api/src/x.spec.ts', "it.skip('x', () => {});"],
    ['apps/api/src/x.spec.ts', "describe.only('x', () => {});"],
    ['apps/api/src/x.spec.ts', "it.todo('x');"],
    ['apps/api/src/x.spec.ts', "describe.skipIf(true)('x', () => {});"],
    ['apps/api/src/x.spec.ts', "it.runIf(false)('x', () => {});"],
    ['apps/web-e2e/tests/x.spec.ts', "test.fixme('x', async () => {});"],
    ['apps/web-e2e/tests/x.spec.ts', "test.skip(true, 'not here');"],
    ['libs/web/core/src/x.spec.ts', "test.only('x', () => {});"],
    ['apps/web-e2e/tests/x.spec.ts', "test.describe.skip('x', () => {});"],
    ['apps/web-e2e/tests/x.spec.ts', "test.describe.fixme('x', () => {});"],
    ['apps/api/src/x.spec.ts', "it.concurrent.skip('x', () => {});"],
    ['apps/api/src/x.spec.ts', "suite.skip('x', () => {});"],
    ['apps/api/src/x.spec.ts', "import { it as t } from 'vitest'; t.skip('x', () => {});"],
    ['apps/api/src/x.spec.ts', "it('x', (ctx) => { ctx.skip(); });"],
    ['apps/web-e2e/tests/owner.setup.ts', "test.skip(true, 'no');"],
  ];

  it.each(cases)('rejects %s: %s', async (filePath, code) => {
    expect(await restricted(filePath, code)).toBe(1);
  });

  it('leaves ordinary tests alone', async () => {
    expect(await restricted('apps/api/src/x.spec.ts', "it('x', () => {});")).toBe(0);
  });
});
