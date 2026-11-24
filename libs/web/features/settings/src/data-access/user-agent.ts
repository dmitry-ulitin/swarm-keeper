/** Browser and system read from a user agent; `null` when not recognised. */
export interface DeviceInfo {
  browser: string | null;
  os: string | null;
}

// Order matters: Edge, Opera and Samsung Internet also say "Chrome"; Chrome also says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
];

// iPadOS and iOS before macOS (iPhone agents say "like Mac OS X"); Android before Linux.
const SYSTEMS: [RegExp, string][] = [
  [/iPad/, 'iPadOS'],
  [/iPhone|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

const first = (ua: string, rules: [RegExp, string][]) =>
  rules.find(([pattern]) => pattern.test(ua))?.[1] ?? null;

/** A small parser of our own: enough to tell a person's devices apart. */
export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { browser: null, os: null };
  return { browser: first(ua, BROWSERS), os: first(ua, SYSTEMS) };
}

/** "Chrome · Windows", or null when nothing is known. */
export function deviceLabel(ua: string | null | undefined): string | null {
  const { browser, os } = parseUserAgent(ua);
  return [browser, os].filter(Boolean).join(' · ') || null;
}
