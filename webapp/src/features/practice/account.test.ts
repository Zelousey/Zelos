import { describe, expect, it } from 'vitest';
import type { Quote } from '../../data/markets';
import { parseAccount, sellableShares, valueAccount } from './account';

const q = (c: number, pc: number): Quote => ({ c, pc, o: c, h: c, l: c, t: 0, v: 0, chPct: null });

describe('practice account (display)', () => {
  const raw = {
    cash: 5000,
    positions: { AAPL: { qty: 10, avg: 100, openedDay: '2026-10-01' }, MSFT: { qty: 5, avg: 400, openedDay: '2026-10-07' }, ZERO: { qty: 0, avg: 1 } },
    orders: {
      a: { id: 'a', sym: 'NVDA', side: 'buy', type: 'limit', qty: 2, limit: 150, tif: 'gtc', createdAt: 2 },
      b: { id: 'b', sym: 'AAPL', side: 'sell', type: 'limit', qty: 3, limit: 130, tif: 'day', createdAt: 1 },
      c: { id: 'c', sym: 'AAPL', side: 'sell', type: 'stop', qty: 10, stop: 90, tif: 'gtc', createdAt: 3, oco: 'g', role: 'sl' },
    },
    resetHistory: [{ equityBefore: 2000 }],
    stats: { trades: 4, wins: 3, losses: 1 },
  };
  const a = parseAccount(raw);

  it('parses positions and orders, dropping empty positions', () => {
    expect(a.positions.map((p) => p.sym)).toEqual(['AAPL', 'MSFT']);
    expect(a.orders.map((o) => o.id)).toEqual(['c', 'a', 'b']);
    expect(a.orders[0]!.role).toBe('sl');
  });

  it('values with quotes like the server, including resets in net P&L', () => {
    const v = valueAccount(a, { AAPL: q(110, 105) }, '2026-10-07');
    // AAPL at 110 (from quote), MSFT has no quote: valued at cost
    expect(v.equity).toBe(5000 + 1100 + 2000);
    expect(v.openPnl).toBe(100);
    expect(v.dayPnl).toBe(50 + 0); // AAPL vs prev close 105; MSFT bought today at cost
    expect(v.buyingPower).toBe(5000 - 300);
    expect(v.netPnl).toBe(8100 - 10000 + (2000 - 10000));
  });

  it('bracket exits do not hold shares back', () => {
    expect(sellableShares(a, 'AAPL')).toBe(7);
    expect(sellableShares(a, 'TSLA')).toBe(0);
  });
});
