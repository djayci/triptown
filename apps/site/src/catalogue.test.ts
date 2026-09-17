import { describe, expect, it } from 'vitest';
import { catalogue, liveEntries, playUrl, type Entry } from './catalogue';

const entry = (over: Partial<Entry>): Entry => ({
  slug: 'demo',
  app: 'demo',
  name: 'Demo',
  pitch: 'A demo.',
  status: 'live',
  logo: ['DEMO', 'GAME'],
  accent: '#000',
  demoQuery: {},
  ...over,
});

describe('catalogue', () => {
  it('has unique slugs', () => {
    const slugs = catalogue.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every entry a name, a pitch and two logo words, and every live entry a tile', () => {
    for (const e of catalogue) {
      expect(e.name.trim()).not.toBe('');
      expect(e.pitch.trim()).not.toBe('');
      expect(e.logo.every((w) => w.trim() !== '')).toBe(true);
    }
    for (const e of liveEntries()) expect(e.tile).toBeDefined();
  });

  it('lists Whack Crash and Gate Rush as live and The Cable Car as in development', () => {
    expect(liveEntries().map((e) => e.slug)).toEqual(['whack', 'gate']);
    expect(catalogue.find((e) => e.slug === 'cable-car')?.status).toBe('in-development');
  });
});

describe('playUrl', () => {
  it('opens a live demo at index.html with its query', () => {
    expect(playUrl(entry({ slug: 'gate', demoQuery: { profile: 'ng-draft', skin: 'adult' } }))).toBe(
      '/play/gate/index.html?profile=ng-draft&skin=adult',
    );
  });

  it('encodes the query', () => {
    expect(playUrl(entry({ demoQuery: { profile: 'a b&c' } }))).toBe('/play/demo/index.html?profile=a+b%26c');
  });

  it('omits the question mark when there is no query', () => {
    expect(playUrl(entry({}))).toBe('/play/demo/index.html');
  });

  it('gives an in-development game no link', () => {
    expect(playUrl(entry({ status: 'in-development' }))).toBeNull();
  });
});
