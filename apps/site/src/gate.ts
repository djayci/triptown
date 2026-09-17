/**
 * The 18+ gate. Nobody plays a demo without tapping "YES, 18+" in this browser session, and the server
 * enforces it on every file under /play/ (spec: No play without the 18+ confirmation). This is a
 * self-declaration, not age verification.
 */
export const GATE_COOKIE = 'tt_age';

/** A session cookie: no maxAge or expires, so closing the browser asks again. */
export const GATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const;

export function isConfirmed(cookies: { get(name: string): { value: string } | undefined }): boolean {
  return cookies.get(GATE_COOKIE)?.value === '1';
}

/**
 * The page to return to after confirming, or null. Only a demo path on this site: anything else would
 * make the gate an open redirect.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  for (const candidate of [value, decoded]) {
    if (!candidate.startsWith('/play/')) return null;
    if (candidate.includes('//') || candidate.includes('\\') || candidate.includes('..')) return null;
    if ([...candidate].some((ch) => ch.charCodeAt(0) < 0x20)) return null;
  }
  return value;
}

/** What the proxy does with a /play/ request: null lets it through, a string is the redirect target. */
export function gateRedirect(confirmed: boolean, pathname: string, search: string): string | null {
  if (confirmed) return null;
  return `/?next=${encodeURIComponent(pathname + search)}`;
}
