/** A same-origin path to go to after sign-in; anything else (another site, a scheme) → `/`. */
export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/';
  }
  try {
    const base = 'https://app.invalid';
    return new URL(value, base).origin === base ? value : '/';
  } catch {
    return '/';
  }
}
