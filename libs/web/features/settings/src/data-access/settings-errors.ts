/**
 * Keys built at runtime, listed for transloco-keys-manager:
 * t(errors.auth.LAST_SIGN_IN_METHOD, errors.auth.SESSION_NOT_FRESH, errors.auth.CURRENT_SESSION, errors.auth.SESSION_NOT_FOUND, errors.auth.INVALID_PASSWORD, errors.auth.INVALID_CODE, errors.auth.NAME_TOO_LONG, errors.auth.TOO_MANY_REQUESTS, errors.auth.PASSKEY_CANCELLED, errors.auth.UNKNOWN)
 */
const KNOWN = new Set([
  'LAST_SIGN_IN_METHOD',
  'SESSION_NOT_FRESH',
  'CURRENT_SESSION',
  'SESSION_NOT_FOUND',
  'INVALID_PASSWORD',
  'INVALID_CODE',
  'NAME_TOO_LONG',
  'TOO_MANY_REQUESTS',
]);

/** What the browser or Better Auth report when the person closes the passkey prompt. */
export const CANCELLED = new Set([
  'AUTH_CANCELLED',
  'REGISTRATION_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
]);

/** The translation key for an error code on the settings screens. */
export function errorKey(code: string | null | undefined): string {
  if (code && CANCELLED.has(code)) return 'errors.auth.PASSKEY_CANCELLED';
  return `errors.auth.${code && KNOWN.has(code) ? code : 'UNKNOWN'}`;
}

/** The code of an error from AuthService or an HTTP call (`{ code }` body). */
export function codeOf(error: unknown): string {
  if (!error || typeof error !== 'object') return 'UNKNOWN';
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  const body = (error as { error?: { code?: unknown } }).error;
  return typeof body?.code === 'string' ? body.code : 'UNKNOWN';
}
