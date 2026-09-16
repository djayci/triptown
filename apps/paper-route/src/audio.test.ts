import { beforeEach, describe, expect, it, vi } from 'vitest';

// Howler needs a browser; the manager is replaced by a recorder so the loading rules can be tested in node.
const created: { muted: boolean[]; storage: unknown }[] = [];
vi.mock('@triptown/engine/audio', () => ({
  AudioManager: class {
    muted: boolean[] = [];
    constructor(_m: unknown, storage: unknown) {
      created.push({ muted: this.muted, storage });
    }
    setMuted(v: boolean) {
      this.muted.push(v);
    }
  },
}));

const { PaperRouteAudio } = await import('./audio');

const manifest = { sfx: { src: ['audio/sfx.webm', 'audio/sfx.mp3'], sprite: { throw: [0, 300] } }, engine: { src: ['audio/engine.webm'], loop: [1000, 2000] } };

describe('PaperRouteAudio.load', () => {
  beforeEach(() => {
    created.length = 0;
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(manifest)));
  });

  it('starts muted on a first visit under a muted profile, but keeps a stored choice', async () => {
    const empty = { getItem: () => null, setItem() {} };
    await PaperRouteAudio.load({ soundDefault: 'muted', intensityEffects: () => false, storage: empty });
    expect(created[0]!.muted).toEqual([true]);
    const stored = { getItem: () => '{"muted":false,"music":0.6,"sfx":0.9}', setItem() {} };
    await PaperRouteAudio.load({ soundDefault: 'muted', intensityEffects: () => false, storage: stored });
    expect(created[1]!.muted).toEqual([]);
  });

  it('still loads when storage is blocked, as in a sandboxed iframe', async () => {
    const blocked = { getItem: () => { throw new DOMException('denied', 'SecurityError'); }, setItem: () => { throw new DOMException('denied', 'SecurityError'); } };
    const audio = await PaperRouteAudio.load({ soundDefault: 'on', intensityEffects: () => true, storage: blocked });
    expect(audio).not.toBeNull();
    const none = await PaperRouteAudio.load({ soundDefault: 'muted', intensityEffects: () => true, storage: null });
    expect(none).not.toBeNull();
    expect(created.at(-1)!.muted).toEqual([true]);
  });

  it('resolves null (silent game) when the manifest cannot be fetched', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 404 }));
    expect(await PaperRouteAudio.load({ soundDefault: 'on', intensityEffects: () => true })).toBeNull();
  });
});
