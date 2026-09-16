import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { findForbidden } from './check-vocabulary.mjs';
import { en } from '../src/i18n/en';

describe('vocabulary check', () => {
  it('flags racing words', () => {
    expect(findForbidden('Next race in 5s')).toEqual(['race']);
    expect(findForbidden('Place your bet slip, best odds')).toEqual(['slip', 'odds']);
  });

  it('allows "stake" and the "no race result" statement', () => {
    expect(findForbidden('Stake lost')).toEqual([]);
    expect(findForbidden('This game has no race result.')).toEqual([]);
  });

  it('passes the catalogue', () => {
    for (const text of Object.values(en)) expect(findForbidden(text)).toEqual([]);
  });
});
