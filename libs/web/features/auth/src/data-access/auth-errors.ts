/**
 * Keys built at runtime, listed for transloco-keys-manager:
 * t(errors.auth.INVALID_EMAIL_OR_PASSWORD, errors.auth.INVALID_CODE, errors.auth.INVALID_BACKUP_CODE, errors.auth.TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE, errors.auth.TOO_MANY_REQUESTS, errors.auth.PASSWORD_TOO_SHORT, errors.auth.PASSWORD_TOO_LONG, errors.auth.INVALID_TOKEN, errors.auth.INVITE_REQUIRED, errors.auth.INVITATION_NOT_FOUND, errors.auth.NAME_REQUIRED, errors.auth.NAME_TOO_LONG, errors.auth.USER_ALREADY_EXISTS, errors.auth.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION, errors.auth.PASSKEY_CANCELLED, errors.auth.UNKNOWN)
 */
/** Codes with their own text under `errors.auth.*`; anything else reads as UNKNOWN. */
const KNOWN = new Set([
  'INVALID_EMAIL_OR_PASSWORD',
  'INVALID_CODE',
  'INVALID_BACKUP_CODE',
  'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE',
  'TOO_MANY_REQUESTS',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'INVALID_TOKEN',
  'INVITE_REQUIRED',
  'INVITATION_NOT_FOUND',
  'NAME_REQUIRED',
  'NAME_TOO_LONG',
  'USER_ALREADY_EXISTS',
  'YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION',
]);

/** What the browser or Better Auth report when the person closes the passkey prompt. */
const CANCELLED = new Set(['AUTH_CANCELLED', 'REGISTRATION_CANCELLED', 'ERROR_CEREMONY_ABORTED']);

/** The translation key for an auth error code. */
export function authErrorKey(code: string | null | undefined): string {
  if (code && CANCELLED.has(code)) return 'errors.auth.PASSKEY_CANCELLED';
  if (code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') return 'errors.auth.USER_ALREADY_EXISTS';
  return `errors.auth.${code && KNOWN.has(code) ? code : 'UNKNOWN'}`;
}

/** The code of an error thrown by AuthService (or anything else). */
export function codeOf(error: unknown): string {
  return error &&
    typeof error === 'object' &&
    typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : 'UNKNOWN';
}
