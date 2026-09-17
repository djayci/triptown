import { describe, expect, it } from 'vitest';
import { catalogue, type Entry } from './catalogue';
import {
  bannedWording,
  duplicateSlugs,
  missingFiles,
  requiredStatements,
} from './checks';
import { allCopyStrings, TRIPTYCH_URL } from './copy';

const entry = (over: Partial<Entry>): Entry => ({
  slug: 'demo',
  app: 'whack',
  name: 'Demo',
  pitch: 'A demo.',
  status: 'live',
  logo: ['DEMO', 'GAME'],
  tile: 'whack-candy',
  accent: '#000',
  demoQuery: {},
  ...over,
});

describe('the real site passes every check', () => {
  it('catalogue and copy', () => {
    const strings = [...allCopyStrings(), ...catalogue.flatMap((e) => [e.name, e.pitch, ...e.logo])];
    expect(duplicateSlugs(catalogue)).toEqual([]);
    expect(bannedWording(strings)).toEqual([]);
    expect(requiredStatements(allCopyStrings(), TRIPTYCH_URL)).toEqual([]);
  });
});

describe('each rule fails on its fixture', () => {
  it('duplicate slug', () => {
    const problems = duplicateSlugs([entry({}), entry({ name: 'Other' })]);
    expect(problems).toEqual([{ rule: 'duplicate-slug', detail: 'slug "demo" is used twice' }]);
  });

  it('missing demo build', () => {
    const problems = missingFiles([entry({ name: 'Ghost' })], () => false);
    expect(problems).toEqual([{ rule: 'demo-build', detail: 'Ghost: no demo build at public/play/demo/index.html' }]);
  });

  it('a live entry with no logo tile', () => {
    const problems = missingFiles([entry({ tile: undefined })], () => true);
    expect(problems).toEqual([{ rule: 'tile', detail: 'Demo: a live game needs a logo tile theme' }]);
  });

  it('ignores in-development entries for files', () => {
    expect(missingFiles([entry({ status: 'in-development' })], () => false)).toEqual([]);
  });

  describe('banned wording', () => {
    it.each([
      ['win promise', 'Win big tonight'],
      ['win promise', 'Huge payouts every round'],
      ['easy or guaranteed money', 'Easy money for everyone'],
      ['easy or guaranteed money', 'A guaranteed return'],
      ['skill or timing claim', 'Perfect your timing'],
      ['skill or timing claim', 'A game of skill'],
      ['skill or timing claim', 'Test your reflexes'],
      ['multiplier boast', 'Up to x1000'],
      ['multiplier boast', 'Multipliers of 5000x'],
      ['multiplier boast', 'Max multiplier revealed'],
      ['RTP figure', 'RTP 97%'],
      ['RTP figure', 'Pays back 96.5%'],
      ['success or wealth', 'Life-changing moments'],
      ['success or wealth', 'Live the rich life'],
      ['success or wealth', 'Your fortune awaits'],
    ])('%s: "%s"', (category, text) => {
      const problems = bannedWording([text]);
      expect(problems.map((p) => p.detail.split(':')[0])).toContain(category);
      expect(problems[0]!.detail).toContain(text);
    });
  });

  it('missing play-money and 18+ statements', () => {
    const problems = requiredStatements(['Hello'], TRIPTYCH_URL);
    expect(problems.map((p) => p.rule)).toEqual(['play-money', 'age']);
  });

  it('wrong Triptych link', () => {
    const problems = requiredStatements(allCopyStrings(), 'https://triptych.example/');
    expect(problems).toEqual([
      { rule: 'triptych', detail: 'Triptych link is https://triptych.example/, expected https://triptych-studio.com/' },
    ]);
  });
});
