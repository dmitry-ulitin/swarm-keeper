import { describe, expect, it } from 'vitest';
import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it.each([
    ['/invite/x', '/invite/x'],
    ['/a?b=1#c', '/a?b=1#c'],
    ['//evil.example', '/'],
    ['https://evil.example/x', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/'],
    [null, '/'],
  ])('%o → %s', (value, expected) => {
    expect(safeReturnUrl(value)).toBe(expected);
  });
});
