import { beforeEach, describe, expect, it } from 'vitest';
import type { Bar } from '../../data/markets';
import { miniFor, MINI_DAYS } from './miniSeries';
import { recentSymbols, rememberSymbol } from './useLastSymbol';

const bars = (n: number, start = 100): Bar[] => Array.from({ length: n }, (_, i) => [`2026-09-${String(i + 1).padStart(2, '0')}`, start + i, start + i + 1, start + i - 1, start + i, 1000]);

describe('mini charts', () => {
  it('last month of closes, period change from the first point', () => {
    const m = miniFor(bars(30), undefined);
    expect(m.closes).toHaveLength(MINI_DAYS);
    expect(m.closes[0]).toBe(108);
    expect(m.price).toBe(129);
    expect(m.periodPct).toBeCloseTo((129 / 108 - 1) * 100);
    expect(m.chPct).toBeNull();
  });
  it("today's live quote becomes the newest point", () => {
    const q = { c: 150, o: 130, h: 151, l: 129, pc: 129, t: Date.parse('2026-10-07T15:00:00Z') / 1000, v: 1, chPct: 16.3 };
    const m = miniFor(bars(30), q);
    expect(m.closes.at(-1)).toBe(150);
    expect(m.price).toBe(150);
    expect(m.chPct).toBe(16.3);
  });
  it('no history: empty line, price from the quote', () => {
    expect(miniFor(undefined, undefined)).toEqual({ closes: [], price: null, chPct: null, periodPct: null });
  });
});

describe('recent symbols', () => {
  beforeEach(() => localStorage.clear());
  it('newest first, no duplicates, at most 8, junk ignored', () => {
    for (const s of ['AAPL', 'MSFT', 'AAPL', 'nope!', ...'ABCDEFGHI'.split('')]) rememberSymbol(s);
    const r = recentSymbols();
    expect(r).toHaveLength(8);
    expect(r[0]).toBe('I');
    expect(r).not.toContain('nope!');
    localStorage.setItem('zelosAppRecentSymbols', '{"x":1}');
    expect(recentSymbols()).toEqual([]);
  });
});
