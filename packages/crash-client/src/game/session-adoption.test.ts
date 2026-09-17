import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The bet clamp lives in adoptSession(). It first lived in refreshSession() alone, and init()
// assigned `this.session` directly around it — so the FIRST bet of every naira or cedi session was
// refused, while every bet after a refresh was fine. The defect was not the clamp; it was a second
// assignment site. This pins the shape rather than one symptom: assign the session in one place.
describe('session adoption', () => {
  const src = readFileSync(new URL('./controller.ts', import.meta.url), 'utf8');

  it('assigns the session in exactly one place', () => {
    const assignments = [...src.matchAll(/this\.session\s*=\s*/g)];
    expect(
      assignments.length,
      'this.session must only be assigned inside adoptSession(), which applies the bet clamp',
    ).toBe(1);
  });

  it('keeps that one place inside adoptSession', () => {
    const adopt = src.slice(src.indexOf('private adoptSession'));
    const body = adopt.slice(0, adopt.indexOf('\n  }\n'));
    expect(body).toContain('this.session = session');
    expect(body).toContain('clampBet');
  });

  it('routes both entry points through it', () => {
    expect(src).toContain('this.adoptSession(await this.service.getSession())');
    expect([...src.matchAll(/adoptSession\(await this\.service\.getSession\(\)\)/g)]).toHaveLength(2);
  });
});
