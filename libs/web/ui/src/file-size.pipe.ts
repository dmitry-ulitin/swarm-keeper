import { Pipe, type PipeTransform } from '@angular/core';

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/** A file size in decimal units (1 kB = 1000 bytes), formatted by `Intl` for the locale. */
export function formatFileSize(bytes: number, locale: string): string {
  const format = (unit: string, value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value);
  let value = bytes;
  let index = 0;
  // Move up while the value, rounded as it will be shown, reaches 1000.
  while (index < UNITS.length - 1 && Math.round(value * 10) / 10 >= 1000) {
    value /= 1000;
    index += 1;
  }
  return format(UNITS[index] ?? 'byte', value);
}

/** `{{ bytes | fileSize: lang }}`: pure, so the locale is passed in. */
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number, locale: string): string {
    return formatFileSize(bytes, locale);
  }
}
