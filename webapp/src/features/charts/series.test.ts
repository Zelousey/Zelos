import { describe, expect, it } from 'vitest';
import type { Bar, Quote } from '../../data/markets';
import { barsFor, dailyBars, intradayBars, weekKey, weeklyBars } from './series';

const q = (c: number, isoNy: string, extra: Partial<Quote> = {}): Quote => ({ c, o: 100, h: c, l: c, pc: 100, t: Date.parse(isoNy) / 1000, v: 10, chPct: null, ...extra });

describe('series', () => {
  const hist: Bar[] = [
    ['2026-10-05', 100, 102, 99, 101, 1000],
    ['2026-10-06', 101, 103, 100, 102, 1100],
  ];

  it('daily: a quote from a new day adds today, same day updates the last bar', () => {
    const add = dailyBars(hist, q(105, '2026-10-07T14:00:00Z', { o: 102, h: 106, l: 101 }));
    expect(add.live).toBe(true);
    expect(add.bars.at(-1)).toEqual(['2026-10-07', 102, 106, 101, 105, 10]);
    const upd = dailyBars(hist, q(104, '2026-10-06T19:00:00Z'));
    expect(upd.bars).toHaveLength(2);
    expect(upd.bars.at(-1)).toEqual(['2026-10-06', 101, 104, 100, 104, 1100]);
    expect(hist[1]).toEqual(['2026-10-06', 101, 103, 100, 102, 1100]); // input untouched
  });

  it('daily: an older quote changes nothing', () => {
    expect(dailyBars(hist, q(90, '2026-10-01T15:00:00Z'))).toEqual({ bars: hist, live: false });
  });

  it('weekly groups Monday to Friday', () => {
    expect(weekKey('2026-10-07')).toBe('2026-10-05');
    expect(weekKey('2026-10-05')).toBe('2026-10-05');
    expect(weekKey('2026-10-04')).toBe('2026-09-28');
    const w = weeklyBars([['2026-10-02', 1, 2, 0.5, 1.5, 1], ['2026-10-05', 2, 3, 1, 2.5, 2], ['2026-10-06', 2.5, 4, 2, 3, 3]]);
    expect(w).toEqual([['2026-09-28', 1, 2, 0.5, 1.5, 1], ['2026-10-05', 2, 4, 1, 3, 5]]);
  });

  it('1H buckets 15-minute bars from 9:30 and the live quote moves the last bar', () => {
    const base: Bar[] = [
      ['2026-10-07 09:30', 10, 11, 9, 10.5, 1],
      ['2026-10-07 09:45', 10.5, 12, 10, 11, 1],
      ['2026-10-07 10:15', 11, 11.5, 10.8, 11.2, 1],
      ['2026-10-07 10:30', 11.2, 11.3, 11, 11.1, 1],
    ];
    const h = intradayBars(base, 60, q(11.6, '2026-10-07T14:45:00Z'));
    expect(h.map((b) => b[0])).toEqual(['2026-10-07 09:30', '2026-10-07 10:30']);
    expect(h[0]).toEqual(['2026-10-07 09:30', 10, 12, 9, 11.2, 3]);
    expect(h[1]![4]).toBe(11.6);
    expect(intradayBars(base, 15, undefined)).toHaveLength(4);
  });

  it('barsFor picks the right source', () => {
    expect(barsFor('W', { history: hist }).intraday).toBe(false);
    expect(barsFor('15m', { intraday: [] })).toEqual({ bars: [], live: false, intraday: true });
  });
});
