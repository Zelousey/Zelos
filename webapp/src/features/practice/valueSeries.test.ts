import { describe, expect, it } from 'vitest';
import type { Bar, Quote } from '../../data/markets';
import { parseAccount } from './account';
import { change, dailyPoints, intradayPoints, previousClose, sessionDay } from './valueSeries';

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
});
