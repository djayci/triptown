import { describe, expect, it } from 'vitest';
import {
  PROFILE_TEMPLATES,
  effectiveConfig,
  engineOf,
  profileFromTemplate,
  registerGame,
  type JurisdictionProfile,
} from './profiles';

// A skin is only cheap if it genuinely plays the engine's certified configuration. If these ever
// diverge, the game needs its own RTP report and its own lab acceptance, and it is no longer a skin.
registerGame('the-lift', 'whack-crash');

const ORIGIN = ['https://operator.example'];

describe('a game registered as a skin', () => {
  it('names the engine it plays', () => {
    expect(engineOf('the-lift')).toBe('whack-crash');
  });

  it('resolves the engine config under every shipped profile', () => {
    for (const name of Object.keys(PROFILE_TEMPLATES)) {
      const p: JurisdictionProfile = profileFromTemplate(name, ORIGIN);
      const skin = effectiveConfig('the-lift', p);
      const engine = effectiveConfig('whack-crash', p);
      expect(skin, `${name} must resolve the engine's configuration`).toEqual(engine);
      expect(skin.id.startsWith('whack-crash/'), `${name} resolved ${skin.id}`).toBe(true);
    }
  });

  it('introduces no configuration id of its own', () => {
    for (const name of Object.keys(PROFILE_TEMPLATES)) {
      const p = profileFromTemplate(name, ORIGIN);
      expect(effectiveConfig('the-lift', p).id).not.toContain('the-lift');
    }
  });
});
