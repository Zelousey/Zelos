import { describe, expect, it } from 'vitest';
import { openEntries } from './entries';

const buy = (at: number, qty: number, price: number, day = '2026-11-10', opt?: string) => ({ kind: 'fill' as const, side: 'buy', qty, price, at, day, opt });
const sell = (at: number, qty: number) => ({ kind: 'fill' as const, side: 'sell', qty, price: 1, at, day: '2026-11-12' });

describe('openEntries', () => {
  it('pins each buy still held, oldest first', () => {
    expect(openEntries([buy(1, 5, 100), buy(2, 3, 110)], 8, null)).toEqual([{ at: 1, price: 100, qty: 5 }, { at: 2, price: 110, qty: 3 }]);
  });
  it('first in, first out: after a partial sell the newest buys are what is left', () => {
    expect(openEntries([buy(1, 5, 100), buy(2, 3, 110), sell(3, 4)], 4, null)).toEqual([{ at: 1, price: 100, qty: 1 }, { at: 2, price: 110, qty: 3 }]);
  });
  it('nothing for a closed position, and old buys from before it reopened do not count', () => {
    expect(openEntries([buy(1, 5, 100)], 0, null)).toEqual([]);
    expect(openEntries([buy(1, 5, 100, '2026-11-01'), buy(9, 2, 120, '2026-11-12')], 2, '2026-11-12')).toEqual([{ at: 9, price: 120, qty: 2 }]);
  });
  it('shares and option contracts are kept apart', () => {
    const ev = [buy(1, 5, 100), buy(2, 1, 3.2, '2026-11-10', 'AAPL|20261120|C|25000')];
    expect(openEntries(ev, 5, null)).toEqual([{ at: 1, price: 100, qty: 5 }]);
    expect(openEntries(ev, 1, null, 'AAPL|20261120|C|25000')).toEqual([{ at: 2, price: 3.2, qty: 1 }]);
  });
});
