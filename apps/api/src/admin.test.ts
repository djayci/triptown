import { MemoryRoundStore, profileFromTemplate } from '@triptown/core';
import { describe, expect, it } from 'vitest';
import { createApp, profilesFromEnv } from './app';

const call = (app: ReturnType<typeof createApp>, method: string, path: string, token?: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('admin kill switch (1.7)', () => {
  it('requires the admin key and blocks new rounds with 423 game_disabled', async () => {
    const app = createApp({ store: new MemoryRoundStore(), sessionSecret: 's', adminApiKey: 'admin-key' });
    const { token } = (await (await call(app, 'POST', '/v1/sessions', undefined, {})).json()) as { token: string };
    expect((await call(app, 'PUT', '/v1/admin/kill-switch', 'wrong', { key: 'game:whack-crash', enabled: true })).status).toBe(403);
    const on = await call(app, 'PUT', '/v1/admin/kill-switch', 'admin-key', { key: 'game:whack-crash', enabled: true });
    expect(await on.json()).toEqual({ active: ['game:whack-crash'] });
    const blocked = await call(app, 'POST', '/v1/rounds', token, { betMinor: 100 });
    expect(blocked.status).toBe(423);
    expect(await blocked.json()).toMatchObject({ error: { code: 'game_disabled' } });
    await call(app, 'PUT', '/v1/admin/kill-switch', 'admin-key', { key: 'game:whack-crash', enabled: false });
    const ok = await call(app, 'POST', '/v1/rounds', token, { betMinor: 100 });
    expect(ok.status).toBe(200);
    await ok.body?.cancel();
    expect((await call(app, 'PUT', '/v1/admin/kill-switch', 'admin-key', { key: 'bad', enabled: true })).status).toBe(400);
  });

  it('is disabled when no admin key is configured', async () => {
    const app = createApp({ store: new MemoryRoundStore(), sessionSecret: 's' });
    expect((await call(app, 'PUT', '/v1/admin/kill-switch', 'anything', { key: 'game:whack-crash', enabled: true })).status).toBe(403);
  });
});

describe('profiles from env (1.5)', () => {
  it('binds operator and default profiles and refuses overrides in prod mode', async () => {
    const profiles = profilesFromEnv({
      DEFAULT_PROFILE: 'light',
      OPERATORS: JSON.stringify({ acme: { profile: 'regulated-uk', origins: ['https://acme.example'] } }),
    });
    const app = createApp({ store: new MemoryRoundStore(), sessionSecret: 's', profiles });
    const acme = (await (await call(app, 'POST', '/v1/sessions', undefined, { operator: 'acme' })).json()) as { session: { profile: { name: string }; config: { id: string } } };
    expect(acme.session.profile.name).toBe('regulated-uk');
    expect(acme.session.config.id).toBe('whack-crash/v3-rising');
    const override = await call(app, 'POST', '/v1/sessions', undefined, { profile: 'pt-draft' });
    expect(override.status).toBe(403);
    expect(await override.json()).toMatchObject({ error: { code: 'profile_not_allowed' } });
  });

  it('allows the dev override and forbids it in production', () => {
    expect(profilesFromEnv({ ALLOW_PROFILE_OVERRIDE: 'true' }).allowOverride).toBe(true);
    expect(() => profilesFromEnv({ ALLOW_PROFILE_OVERRIDE: 'true', VERCEL_ENV: 'production' })).toThrow(/production/);
    expect(profileFromTemplate('regulated-uk').operatorOrigins).toEqual([]);
  });
});
