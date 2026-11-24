import { describe, expect, it } from 'vitest';
import { slugify } from './family-slug.js';

describe('slugify', () => {
  it.each([
    ['The Ivanovs', 'the-ivanovs'],
    ['Ивановы', 'ivanovy'],
    ['Семья Щукиных', 'semya-shchukinykh'],
    ['Жуковы-Цой', 'zhukovy-tsoy'],
    ['Йошкины, Ёлкины', 'yoshkiny-elkiny'],
    ['Юдины & Ярцевы', 'yudiny-yartsevy'],
    ['Café Müller', 'cafe-muller'],
    ['  ---  ', 'family'],
    ['家族', 'family'],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('transliterates й and ё typed in decomposed form (NFD)', () => {
    expect(slugify('Йошкины Ёлкины'.normalize('NFD'))).toBe('yoshkiny-elkiny');
  });
});
