// node --test: the Angular unit-test builder only runs specs under src.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import config, { forwardClientIp } from './proxy.conf.mjs';

test('replaces a spoofed x-forwarded-for with the socket address', () => {
  const headers = new Map([['x-forwarded-for', '6.6.6.6']]);
  forwardClientIp(
    { setHeader: (name, value) => headers.set(name, value) },
    { socket: { remoteAddress: '127.0.0.1' } },
  );
  assert.equal(headers.get('x-forwarded-for'), '127.0.0.1');
});

test('hooks the rewrite into every proxied /api request', () => {
  const events = [];
  config['/api'].configure({ on: (event, fn) => events.push([event, fn]) });
  assert.deepEqual(events, [['proxyReq', forwardClientIp]]);
  assert.equal(config['/api'].target, 'http://localhost:3000');
});
