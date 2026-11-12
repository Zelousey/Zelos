import { describe, expect, it } from 'vitest';
import type { Bar, Quote } from '../../data/markets';
import { parseAccount } from './account';
import { change, dailyPoints, holdingsAt, intradayPoints, nyMinute, previousClose, sessionDay } from './valueSeries';

const q = (c: number, pc: number): Quote => ({ c, pc, o: c, h: c, l: c, t: 0, v: 0, chPct: null });
const bar = (label: string, c: number): Bar => [label, c, c, c, c, 0];

describe('account value chart data', () => {
  const a = parseAccount({
    cash: 1000,
    positions: { AAPL: { qty: 10, avg: 100 } },
    hist: { d20261005: { e: 1900, n: 0, x: 0 }, d20261006: { e: 2000 }, d20261007: { e: 2050 }, bad: { e: 1 }, d20260601: { e: 1500 } },
  });

  it('reads the daily closes, oldest first', () => {
    expect(a.hist.map((h) => h.day)).toEqual(['2026-06-01', '2026-10-05', '2026-10-06', '2026-10-07']);
    expect(previousClose(a.hist, '2026-10-07', 10000)).toBe(2000);
    expect(previousClose([], '2026-10-07', 10000)).toBe(10000);
  });

  it('longer ranges: closes in the window plus the live value', () => {
    const w = dailyPoints(a.hist, '2026-10-08', 2111, '1W');
    expect(w.map((p) => p.v)).toEqual([1900, 2000, 2050, 2111]);
    expect(dailyPoints(a.hist, '2026-10-08', 2111, '3M')).toHaveLength(4); // June is older than 3 months
    expect(change(w, w[0]!.v).abs).toBe(211);
  });

  it('today: cash + shares at each minute, ending on the live value', () => {
    const bars = { AAPL: [bar('2026-10-07 15:59', 99), bar('2026-10-08 09:30', 101), bar('2026-10-08 09:31', 103), bar('2026-10-08 09:33', 102)] };
    expect(sessionDay(bars, '2026-10-08')).toBe('2026-10-08');
    const pts = intradayPoints(a, bars, { AAPL: q(104, 100) }, '2026-10-08', '2026-10-08', null, 2040, 9 * 60 + 40);
    expect(pts.map((p) => [p.t, p.v])).toEqual([
      [570, 1000 + 1010],
      [571, 1000 + 1030],
      [573, 1000 + 1020],
      [580, 2040], // live
    ]);
  });

  it('on a weekend, today shows the last trading day', () => {
    const bars = { AAPL: [bar('2026-10-09 15:59', 100)] };
    expect(sessionDay(bars, '2026-10-10')).toBe('2026-10-09');
    const pts = intradayPoints(a, bars, {}, '2026-10-09', '2026-10-10', null, 2000, 600);
    expect(pts[pts.length - 1]).toMatchObject({ t: 16 * 60, v: 2000 });
  });

  it('today remembers what you sold: the morning keeps the shares you no longer hold (owner 2026-11-12)', () => {
    // you held 10 AAPL and 5 TSLA this morning; at 09:32 you sold the 5 TSLA at 210 (cash 1000 now includes it)
    const acct = parseAccount({ cash: 2050, positions: { AAPL: { qty: 10, avg: 100 } } });
    const fills = [{ m: 572, sym: 'TSLA', side: 'sell' as const, qty: 5, price: 210 }];
    const before = holdingsAt(acct, fills, 571);
    expect(before.cash).toBe(1000);
    expect(before.shares.get('TSLA')).toEqual({ qty: 5, avg: 210 });
    expect(holdingsAt(acct, fills, 572).shares.has('TSLA')).toBe(false);
    const bars = {
      AAPL: [bar('2026-10-08 09:30', 100), bar('2026-10-08 09:31', 100), bar('2026-10-08 09:32', 100), bar('2026-10-08 09:33', 100)],
      TSLA: [bar('2026-10-08 09:30', 200), bar('2026-10-08 09:31', 230), bar('2026-10-08 09:32', 210), bar('2026-10-08 09:33', 190)],
    };
    const pts = intradayPoints(acct, bars, {}, '2026-10-08', '2026-10-08', null, 3050, 9 * 60 + 34, fills);
    expect(pts.map((p) => [p.t, p.v])).toEqual([
      [570, 1000 + 1000 + 5 * 200], // the morning: TSLA still held
      [571, 1000 + 1000 + 5 * 230], // the peak stays on the line
      [572, 2050 + 1000], // sold: cash, no TSLA
      [573, 2050 + 1000], // TSLA's later drop doesn't touch you
      [574, 3050], // live
    ]);
  });

  it('a buy today: before it, the cash was still there', () => {
    const acct = parseAccount({ cash: 0, positions: { AAPL: { qty: 10, avg: 100 } } });
    const h = holdingsAt(acct, [{ m: 600, sym: 'AAPL', side: 'buy', qty: 10, price: 100 }], 599);
    expect(h.cash).toBe(1000);
    expect(h.shares.get('AAPL')!.qty).toBe(0);
    expect(nyMinute(Date.parse('2026-10-08T13:31:00Z'))).toBe(9 * 60 + 31); // 9:31 am in New York (EDT)
  });
});
