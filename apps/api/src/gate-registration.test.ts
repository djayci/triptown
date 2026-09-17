import { MemoryRoundStore, PROFILE_TEMPLATES, effectiveConfig, engineOf, profileFromTemplate, registeredGames } from '@triptown/core';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

// beat-the-gate-mvp spec "Beat the Gate plays a certified engine's configuration": a skin is only
// cheap while it resolves exactly the engine's certified configuration under every shipped profile.
describe('Beat the Gate registration', () => {
  createApp({ store: new MemoryRoundStore(), sessionSecret: 's' });
  const ORIGIN = ['https://operator.example'];

  it('is registered on the Whack Crash engine and gets a host', () => {
    expect(registeredGames()).toContain('beat-the-gate');
    expect(engineOf('beat-the-gate')).toBe('whack-crash');
  });

  it('resolves the engine configuration, and no id of its own, under every shipped profile', () => {
    for (const name of Object.keys(PROFILE_TEMPLATES)) {
      const p = profileFromTemplate(name, ORIGIN);
      const gate = effectiveConfig('beat-the-gate', p);
      expect(gate, `${name} must resolve the engine's configuration`).toEqual(effectiveConfig('whack-crash', p));
      expect(gate.id).not.toContain('beat-the-gate');
    }
  });
});
