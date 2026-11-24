/**
 * Keys built at runtime, listed for transloco-keys-manager:
 * t(errors.auth.USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION, errors.auth.USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION, errors.auth.YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE, errors.auth.SINGLE_ROLE_REQUIRED, errors.auth.TWO_FACTOR_REQUIRED, errors.auth.TOO_MANY_REQUESTS, errors.auth.UNKNOWN)
 */
const KNOWN = new Set([
  'USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION',
  'USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION',
  'YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE',
  'SINGLE_ROLE_REQUIRED',
  'TWO_FACTOR_REQUIRED',
  'TOO_MANY_REQUESTS',
]);

/** The translation key for an error code on the family screens. */
export function errorKey(code: string | null | undefined): string {
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
