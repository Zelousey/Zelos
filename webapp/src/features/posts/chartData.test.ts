import { describe, expect, it } from 'vitest';
import type { Bar } from '../../data/markets';
import { curveChart, nyLabel, tradeChart } from './chartData';

const bar = (label: string, c: number): Bar => [label, c, c, c, c, 1];

describe('share card chart', () => {
  it('daily: a few days before the buy and after the sale, both marked', () => {
    const days = Array.from({ length: 20 }, (_, i) => bar(`2026-11-${String(i + 1).padStart(2, '0')}`, 101 + i));
    const ch = tradeChart(days, '2026-11-05', '2026-11-12')!;
    expect(ch.t[0]).toBe('2026-11-02');
    expect(ch.t[ch.t.length - 1]).toBe('2026-11-15');
    expect(ch.t[ch.buy!]).toBe('2026-11-05');
    expect(ch.t[ch.sell!]).toBe('2026-11-12');
  });
  it('a day trade: minute prices thinned to ~90 points, buy and sell kept', () => {
    const mins = Array.from({ length: 390 }, (_, m) => bar(`2026-11-12 ${String(9 + Math.floor((m + 30) / 60)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`, 50 + m / 10));
    const ch = tradeChart(mins, '2026-11-12 10:00', '2026-11-12 15:30')!;
    expect(ch.t.length).toBeLessThanOrEqual(92);
    expect(ch.t[ch.buy!]).toBe('2026-11-12 10:00');
    expect(ch.t[ch.sell!]).toBe('2026-11-12 15:30');
  });
  it('no bars for the trade: no chart', () => {
    expect(tradeChart([], 'a', 'b')).toBeNull();
    expect(tradeChart([bar('2026-01-01', 1), bar('2026-01-02', 2)], '2026-12-01', '2026-12-02')).toBeNull();
  });
  it('a battle value line, and New York minute labels', () => {
    const c = curveChart(Array.from({ length: 300 }, (_, i) => ({ t: i, v: 500 + i })))!;
    expect(c.p[0]).toBe(500);
    expect(c.p[c.p.length - 1]).toBe(799);
    expect(c.t.length).toBeLessThanOrEqual(90);
    expect(nyLabel(Date.parse('2026-11-12T15:31:00Z'))).toBe('2026-11-12 10:31');
  });
});
