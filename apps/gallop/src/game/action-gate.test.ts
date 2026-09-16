import { describe, expect, it } from 'vitest';
import { ActionGate } from './action-gate';

describe('ActionGate', () => {
  it('sends one request for five taps within 300 ms', async () => {
    const gate = new ActionGate();
    let requests = 0;
    const jump = () =>
      gate.run(async () => {
        requests++;
        await new Promise((r) => setTimeout(r, 300));
        return 'ok';
      });
    const taps = [jump(), jump(), jump(), jump(), jump()];
    const results = await Promise.all(taps);
    expect(requests).toBe(1);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    await jump();
    expect(requests).toBe(2);
  });
});
