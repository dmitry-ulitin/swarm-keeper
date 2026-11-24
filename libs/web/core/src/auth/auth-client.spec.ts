import { describe, expect, it, vi } from 'vitest';
import { lazyPort } from './auth-client';
import { fakeClient, ok } from './testing';

describe('lazyPort', () => {
  it('loads the client once, on the first call, and delegates', async () => {
    const email = vi.fn(() => ok({ twoFactorRedirect: true }));
    const load = vi.fn(async () => fakeClient({ signIn: { passkey: () => ok({}), email } }));
    const port = lazyPort(load);
    expect(load).not.toHaveBeenCalled();
    await expect(port.signIn.email({ email: 'a', password: 'b' })).resolves.toEqual({
      data: { twoFactorRedirect: true },
      error: null,
    });
    await port.signOut();
    expect(load).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledWith({ email: 'a', password: 'b' });
  });
});
