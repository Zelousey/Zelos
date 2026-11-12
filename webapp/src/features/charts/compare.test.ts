import { describe, expect, it } from 'vitest';
import type { Bar } from '../../data/markets';
import { compareRatios, sectorMembers } from './compare';

const bar = (d: string, c: number): Bar => [d, c, c, c, c, 0];

describe('compare with the sector', () => {
  it('averages each member from its own first price, skipping bars a member has no price for', () => {
    const mine = [bar('d1', 10), bar('d2', 11), bar('d3', 12)];
    const r = compareRatios(mine, { A: [bar('d1', 100), bar('d2', 110), bar('d3', 121)], B: [bar('d2', 50), bar('d3', 40)] });
    expect(r[0]).toBeCloseTo(1); // only A has d1
    expect(r[1]).toBeCloseTo((1.1 + 1) / 2); // B starts at d2
    expect(r[2]).toBeCloseTo((1.21 + 0.8) / 2);
  });
  it('is null where no member has a price', () => {
    expect(compareRatios([bar('x', 1)], { A: [bar('y', 2)] })).toEqual([null]);
  });
  it('a sector is the same group without the stock; intraday only day-trading stocks; ETFs have none', () => {
    const tech = sectorMembers('AAPL', false);
    expect(tech).toContain('NVDA');
    expect(tech).not.toContain('AAPL');
    expect(sectorMembers('AAPL', true).every((s) => ['MSFT', 'NVDA', 'AMZN', 'META', 'AMD'].includes(s))).toBe(true);
    expect(sectorMembers('SPY', false)).toEqual([]);
  });
});
