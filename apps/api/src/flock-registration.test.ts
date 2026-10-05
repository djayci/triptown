import {
  MemoryRoundStore,
  PROFILE_TEMPLATES,
  effectiveConfig,
  effectiveReveal,
  engineOf,
  profileFromTemplate,
  registeredGames,
} from '@triptown/core';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

// flock-mvp spec "Flock plays a certified engine's configuration": a skin stays cheap only while it
// resolves exactly the engine's certified configuration, and Flock never opts into deferred reveal.
describe('Flock registration', () => {
  createApp({ store: new MemoryRoundStore(), sessionSecret: 's' });
  const ORIGIN = ['https://operator.example'];

  it('is registered on the Whack Crash engine', () => {
    expect(registeredGames()).toContain('flock');
    expect(engineOf('flock')).toBe('whack-crash');
  });

  it('resolves the engine configuration, and no id of its own, under every shipped profile', () => {
    for (const name of Object.keys(PROFILE_TEMPLATES)) {
      const p = profileFromTemplate(name, ORIGIN);
      const flock = effectiveConfig('flock', p);
      expect(flock, `${name} must resolve the engine's configuration`).toEqual(
        effectiveConfig('whack-crash', p),
      );
      expect(flock.id).not.toContain('flock');
    }
  });

  it('plays live even under a profile that asks for the deferred reveal', () => {
    const deferred = Object.keys(PROFILE_TEMPLATES)
      .map((name) => profileFromTemplate(name, ORIGIN))
      .filter((p) => p.crashReveal === 'onCollect');
    expect(deferred.length).toBeGreaterThan(0);
    for (const p of deferred) {
      expect(effectiveReveal('flock', p, effectiveConfig('flock', p))).toBe('live');
    }
  });
});
