import { describe, expect, it } from 'vitest';
import { FileSizePipe, formatFileSize } from './file-size.pipe';

const intl = (locale: string, unit: string, value: number) =>
  new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);

describe('formatFileSize', () => {
  it('formats megabytes in English', () => {
    expect(formatFileSize(3_400_000, 'en')).toBe('3.4 MB');
  });

  it('formats megabytes in Russian', () => {
    expect(formatFileSize(3_400_000, 'ru')).toBe(intl('ru', 'megabyte', 3.4));
    expect(formatFileSize(3_400_000, 'ru')).toMatch(/^3,4\s?МБ$/);
  });

  it('keeps small sizes in bytes', () => {
    expect(formatFileSize(512, 'en')).toBe(intl('en', 'byte', 512));
    expect(formatFileSize(0, 'en')).toBe(intl('en', 'byte', 0));
  });

  it('moves up a unit when rounding reaches 1000', () => {
    expect(formatFileSize(999_999, 'en')).toBe('1 MB');
  });
});

describe('FileSizePipe', () => {
  it('formats with the given locale', () => {
    expect(new FileSizePipe().transform(3_400_000, 'en')).toBe('3.4 MB');
  });
});
