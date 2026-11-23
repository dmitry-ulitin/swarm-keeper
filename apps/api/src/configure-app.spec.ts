import { describe, expect, it } from 'vitest';
import { listenAddress } from './configure-app.js';

describe('listenAddress', () => {
  // The client IP is read from x-forwarded-for, so the API must not be reachable around the proxy.
  it('listens on loopback, port 3000 by default', () => {
    expect(listenAddress({})).toEqual({ port: 3000, host: '127.0.0.1' });
  });

  it('takes PORT and HOST from the environment', () => {
    expect(listenAddress({ PORT: '8080', HOST: '0.0.0.0' })).toEqual({
      port: 8080,
      host: '0.0.0.0',
    });
  });
});
