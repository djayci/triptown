import { describe, expect, it } from 'vitest';
import { Courier } from './courier';

describe('Courier', () => {
  it.each([5, 3, 0])('shows %i rolls for %i unthrown papers', (papers) => {
    const courier = new Courier();
    courier.setRolls(papers);
    expect(courier.visibleRolls).toBe(papers);
  });

  it('caps visible rolls at 5 and switches to the fallen pose', () => {
    const courier = new Courier();
    courier.setRolls(8);
    expect(courier.visibleRolls).toBe(5);
    courier.setPose('fallen');
    const [riding, fallen] = courier.group.children;
    expect(riding?.visible).toBe(false);
    expect(fallen?.visible).toBe(true);
  });
});
