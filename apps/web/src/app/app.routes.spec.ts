import { describe, expect, it } from 'vitest';
import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('puts home, settings and family under the signed-in shell', () => {
    const shell = appRoutes(false).find((route) => route.path === '' && route.children);
    expect(shell?.canMatch).toHaveLength(1);
    expect(shell?.children?.map((route) => route.path)).toEqual(['', 'settings', 'family']);
  });
});
