import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LAYOUT_COLORS, type LayoutInput, escapeHtml, renderLayout } from './layout.js';

const input: LayoutInput = {
  lang: 'en',
  heading: 'Heading',
  paragraphs: ['First paragraph.'],
  action: { label: 'Open', url: 'https://archive.example/x' },
  notes: ['A note.'],
  footer: 'Footer',
};

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'J'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;J&#39;&lt;/a&gt;',
    );
  });
});

describe('renderLayout', () => {
  it('escapes the text it is given', () => {
    const html = renderLayout({ ...input, heading: '<b>x</b>', notes: ['<i>n</i>'] });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('<i>n</i>');
  });

  it('keeps a link with a query string working', () => {
    const url = 'https://h/reset/tok?callbackURL=/x&y=1';
    const html = renderLayout({ ...input, action: { label: 'Go', url } });
    expect(html).toContain('href="https://h/reset/tok?callbackURL=/x&amp;y=1"');
  });

  it('marks the document language', () => {
    expect(renderLayout({ ...input, lang: 'ru' })).toContain('<html lang="ru">');
  });

  it('uses only light-theme colors from tokens.json', () => {
    const tokens = JSON.parse(
      readFileSync(new URL('../../../../../docs/design/tokens.json', import.meta.url), 'utf8'),
    ) as { color: { tokens: { name: string; value: { light: string } }[] } };
    const light = new Map(tokens.color.tokens.map((t) => [t.name, t.value.light]));
    for (const [name, value] of Object.entries(LAYOUT_COLORS)) {
      expect(value, name).toBe(light.get(name));
    }
    const used = renderLayout(input).match(/#[0-9a-f]{6}\b/gi) ?? [];
    const allowed = new Set(Object.values(LAYOUT_COLORS).map((v) => v.toLowerCase()));
    expect(used.length).toBeGreaterThan(0);
    for (const color of used) {
      expect(allowed.has(color.toLowerCase()), color).toBe(true);
    }
  });
});
