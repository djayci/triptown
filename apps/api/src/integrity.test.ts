import { MemoryAuditLog, MemoryRoundStore, profileFromTemplate } from '@triptown/core';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { checkIntegrity } from './integrity';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const script = join(__dirname, '..', '..', '..', 'scripts', 'release-manifest.mjs');

function release(signingKey?: string) {
  const dir = mkdtempSync(join(tmpdir(), 'wc-release-'));
  writeFileSync(join(dir, 'index.mjs'), 'export const handler = () => "ok";');
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  execFileSync('node', [script, dir, '--version', '1.2.3'], {
    env: { ...process.env, ...(signingKey ? { RELEASE_SIGNING_KEY: signingKey } : { RELEASE_SIGNING_KEY: '' }) },
    stdio: 'ignore',
  });
  return dir;
}

describe('software integrity (3.5)', () => {
  it('passes on an unmodified signed release', () => {
    const result = checkIntegrity(release(privatePem), publicPem);
    expect(result).toMatchObject({ ok: true, signatureValid: true, manifestVersion: '1.2.3', checked: 2, mismatched: [], missing: [], unexpected: [] });
  });

  it('fails on tampered, missing-signature or dev-signed releases', () => {
    const dir = release(privatePem);
    writeFileSync(join(dir, 'index.mjs'), 'export const handler = () => "evil";');
    writeFileSync(join(dir, 'extra.js'), '1');
    expect(checkIntegrity(dir, publicPem)).toMatchObject({ ok: false, signatureValid: true, mismatched: ['index.mjs'], unexpected: ['extra.js'] });
    expect(checkIntegrity(release(), publicPem)).toMatchObject({ ok: false, signatureValid: false });
  });

  it('blocks new rounds after a failed check, audits it, and needs an admin to clear', async () => {
    const dir = release(privatePem);
    writeFileSync(join(dir, 'index.mjs'), 'tampered');
    const audit = new MemoryAuditLog();
    const app = createApp({
      store: new MemoryRoundStore(),
      sessionSecret: 's',
      adminApiKey: 'admin',
      audit,
      integrity: { dir, publicKeyPem: publicPem, cronSecret: 'cron' },
      profiles: { defaultProfile: { ...profileFromTemplate('light'), minCycleMs: 0 } },
    });
    const call = (method: string, path: string, token?: string, body?: unknown) =>
      app.request(path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    await new Promise((r) => setTimeout(r, 20)); // cold-start check
    const { token } = (await (await call('POST', '/v1/sessions', undefined, {})).json()) as { token: string };
    const blocked = await call('POST', '/v1/rounds', token, { betMinor: 100 });
    expect(blocked.status).toBe(423);
    expect(await blocked.json()).toMatchObject({ error: { code: 'integrity_blocked' } });
    expect(audit.entries.some((e) => e.type === 'integrity_check' && e.data.trigger === 'cold-start' && e.data.blocked === true)).toBe(true);

    expect((await call('GET', '/v1/admin/integrity/cron', 'wrong')).status).toBe(403);
    expect(await (await call('GET', '/v1/admin/integrity/cron', 'cron')).json()).toEqual({ ok: false });
    const onDemand = (await (await call('GET', '/v1/admin/integrity', 'admin')).json()) as { ok: boolean; blocked: boolean; mismatched: string[] };
    expect(onDemand).toMatchObject({ ok: false, blocked: true, mismatched: ['index.mjs'] });

    expect((await call('POST', '/v1/admin/integrity/clear', 'admin')).status).toBe(200);
    const ok = await call('POST', '/v1/rounds', token, { betMinor: 100 });
    expect(ok.status).toBe(200);
    await ok.body?.cancel();
    expect(audit.entries.some((e) => e.type === 'integrity_check' && e.data.trigger === 'admin-clear')).toBe(true);
  });
});
