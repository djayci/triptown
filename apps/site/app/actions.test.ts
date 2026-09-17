import { beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT ${to}`);
});

vi.mock('next/headers', () => ({ cookies: async () => ({ set }) }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));

const { confirmAge, declineAge } = await import('./actions');

const form = (next?: string) => {
  const data = new FormData();
  if (next !== undefined) data.set('next', next);
  return data;
};

describe('confirmAge', () => {
  beforeEach(() => {
    set.mockClear();
    redirect.mockClear();
  });

  it('sets a session cookie, with no maxAge or expires', async () => {
    await expect(confirmAge(form())).rejects.toThrow('REDIRECT /?unlocked=1#games');
    expect(set).toHaveBeenCalledTimes(1);
    const [name, value, options] = set.mock.calls[0]!;
    expect([name, value]).toEqual(['tt_age', '1']);
    expect(options).not.toHaveProperty('maxAge');
    expect(options).not.toHaveProperty('expires');
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  });

  it('returns to the demo the visitor asked for', async () => {
    await expect(confirmAge(form('/play/gate/index.html?skin=adult'))).rejects.toThrow(
      'REDIRECT /play/gate/index.html?skin=adult',
    );
  });

  it('never redirects off the demos', async () => {
    await expect(confirmAge(form('https://evil.com/'))).rejects.toThrow('REDIRECT /?unlocked=1#games');
    await expect(confirmAge(form('//evil.com'))).rejects.toThrow('REDIRECT /?unlocked=1#games');
  });
});

describe('declineAge', () => {
  beforeEach(() => set.mockClear());

  it('stores nothing', async () => {
    await expect(declineAge()).rejects.toThrow('REDIRECT /?declined=1');
    expect(set).not.toHaveBeenCalled();
  });
});
