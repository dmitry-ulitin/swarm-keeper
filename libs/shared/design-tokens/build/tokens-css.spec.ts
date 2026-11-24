import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTokensCss } from './tokens-css.js';

interface Group {
  tokens: { name: string; value: unknown }[];
}
interface Tokens {
  color: Group;
  spacing: Group;
  radius: Group;
  size: Group;
  shadow: Group;
  type: { groups: { styles: { name: string }[] }[] };
}

const tokensPath = new URL('../../../../docs/design/tokens.json', import.meta.url);
const real = (): Tokens => JSON.parse(readFileSync(tokensPath, 'utf8')) as Tokens;

describe('buildTokensCss', () => {
  it('writes colors as light-dark() and resolves references', async () => {
    const css = await buildTokensCss(real());
    expect(css).toContain('--brand: light-dark(#2f5d8c, #8db8e8);');
    expect(css).toContain('--selection: var(--brand);');
    expect(css).toContain('color-scheme: light dark');
  });

  it('writes plain, type and font tokens', async () => {
    const css = await buildTokensCss(real());
    expect(css).toContain('--space-4: 16px;');
    expect(css).toContain('--radius-full: 9999px;');
    expect(css).toContain('--type-body-size: 13px;');
    expect(css).toContain('--type-large-body-size: 17px;');
    expect(css).toContain('--type-display-letter-spacing: -0.01em;');
    expect(css).toMatch(/--font-sans: Inter,/);
  });

  it('puts dark shadows in the dark blocks', async () => {
    const css = await buildTokensCss(real());
    const light =
      '--shadow-md: 0 4px 12px rgba(31, 27, 22, 0.12), 0 1px 3px rgba(31, 27, 22, 0.08);';
    const dark = '--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.55), 0 1px 3px rgba(0, 0, 0, 0.4);';
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    const forced = css.slice(css.indexOf(":root[data-theme='dark']"));
    expect(css.slice(0, css.indexOf('@media'))).toContain(light);
    expect(media).toContain(":root:not([data-theme='light'])");
    expect(media).toContain(dark);
    expect(forced).toContain(dark);
  });

  it('drops no token', async () => {
    const tokens = real();
    const css = await buildTokensCss(tokens);
    for (const group of [tokens.color, tokens.spacing, tokens.radius, tokens.size, tokens.shadow]) {
      for (const { name } of group.tokens) {
        expect(css, name).toContain(`--${name}:`);
      }
    }
    for (const style of tokens.type.groups.flatMap((g) => g.styles)) {
      expect(css, style.name).toContain(`--type-${style.name}-size:`);
    }
  });

  it('fails on a reference to a missing token', async () => {
    const tokens = real();
    const selection = tokens.color.tokens.find((t) => t.name === 'selection');
    if (selection) selection.value = { light: '{nope}', dark: '{nope}' };
    await expect(buildTokensCss(tokens)).rejects.toThrow(/nope/);
  });

  it('matches the committed tokens.css', async () => {
    const committed = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
    expect(committed).toBe(await buildTokensCss(real()));
  });
});
