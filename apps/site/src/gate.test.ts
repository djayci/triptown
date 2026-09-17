import { describe, expect, it } from 'vitest';
import { GATE_COOKIE, GATE_COOKIE_OPTIONS, gateRedirect, isConfirmed, safeNext } from './gate';

const jar = (value?: string) => ({
  get: (name: string) => (name === GATE_COOKIE && value !== undefined ? { value } : undefined),
});

describe('gate cookie', () => {
  it('is a session cookie: no maxAge or expires', () => {
    expect(GATE_COOKIE_OPTIONS).not.toHaveProperty('maxAge');
    expect(GATE_COOKIE_OPTIONS).not.toHaveProperty('expires');
    expect(GATE_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });

  it('confirms only on the exact value', () => {
    expect(isConfirmed(jar('1'))).toBe(true);
    expect(isConfirmed(jar())).toBe(false);
    expect(isConfirmed(jar('0'))).toBe(false);
    expect(isConfirmed(jar(''))).toBe(false);
  });
});

describe('safeNext', () => {
  it('accepts a demo path with its query', () => {
    expect(safeNext('/play/gate/index.html?profile=ng-draft&skin=adult')).toBe(
      '/play/gate/index.html?profile=ng-draft&skin=adult',
    );
    expect(safeNext('/play/whack/assets/atlas-adult.json')).toBe('/play/whack/assets/atlas-adult.json');
  });

  it.each([
    ['//evil.com', 'protocol-relative'],
    ['//evil.com/play/', 'protocol-relative with a play path'],
    ['/play//evil.com', 'double slash inside'],
    ['/play/../x', 'traversal'],
    ['/play/%2e%2e/x', 'encoded traversal'],
    ['/play/%2F%2Fevil.com', 'encoded double slash'],
    ['/play/\\evil.com', 'backslash'],
    ['https://evil.com/play/', 'absolute URL'],
    ['javascript:alert(1)', 'script scheme'],
    ['/', 'home'],
    ['/admin', 'another site path'],
    ['/play/%0d%0aSet-Cookie:x', 'encoded control characters'],
    ['/play/%E0%A4%A', 'malformed encoding'],
    ['', 'empty'],
  ])('rejects %s (%s)', (value) => {
    expect(safeNext(value)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(['/play/gate/index.html'])).toBeNull();
  });
});

describe('gateRedirect', () => {
  it('lets a confirmed visitor through', () => {
    expect(gateRedirect(true, '/play/gate/index.html', '?skin=adult')).toBeNull();
  });

  it('sends everyone else to the gate, remembering where they were going', () => {
    const target = gateRedirect(false, '/play/gate/index.html', '?profile=ng-draft&skin=adult');
    expect(target).toBe('/?next=%2Fplay%2Fgate%2Findex.html%3Fprofile%3Dng-draft%26skin%3Dadult');
    const next = new URL(target!, 'https://site.test').searchParams.get('next');
    expect(safeNext(next)).toBe('/play/gate/index.html?profile=ng-draft&skin=adult');
  });
});
