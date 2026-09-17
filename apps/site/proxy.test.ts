import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, 'https://site.test'), {
    headers: cookie ? { cookie } : {},
  });

describe('proxy', () => {
  it('covers every file under /play/', () => {
    expect(config.matcher).toEqual(['/play/:path*']);
  });

  it.each([
    '/play/gate/index.html?profile=ng-draft&skin=adult',
    '/play/gate/assets/atlas-adult.json',
    '/play/whack/assets/index-abc123.js',
  ])('redirects %s to the gate without the cookie', (path) => {
    const res = proxy(request(path));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/');
    expect(location.searchParams.get('next')).toBe(path);
    expect(res.headers.get('x-middleware-next')).toBeNull();
  });

  it('refuses a wrong cookie value', () => {
    expect(proxy(request('/play/gate/index.html', 'tt_age=0')).status).toBe(307);
  });

  it.each(['/play/gate/index.html?profile=ng-draft&skin=adult', '/play/gate/assets/atlas-adult.json'])(
    'lets %s through with the cookie',
    (path) => {
      const res = proxy(request(path, 'tt_age=1'));
      expect(res.headers.get('location')).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
    },
  );
});
