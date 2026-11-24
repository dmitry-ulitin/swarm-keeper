import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './user-agent';

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
};

describe('parseUserAgent', () => {
  it.each([
    [UA.chromeWindows, 'Chrome', 'Windows'],
    [UA.edgeWindows, 'Edge', 'Windows'],
    [UA.firefoxLinux, 'Firefox', 'Linux'],
    [UA.safariMac, 'Safari', 'macOS'],
    [UA.safariIphone, 'Safari', 'iOS'],
    [UA.chromeAndroid, 'Chrome', 'Android'],
    [UA.samsung, 'Samsung Internet', 'Android'],
  ])('reads %s', (ua, browser, os) => {
    expect(parseUserAgent(ua)).toEqual({ browser, os });
  });

  it.each([null, ''])('knows nothing about %j', (ua) => {
    expect(parseUserAgent(ua)).toEqual({ browser: null, os: null });
  });
});
