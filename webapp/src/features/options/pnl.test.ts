import { describe, expect, it } from 'vitest';
import { quote } from './model';
import { breakeven, curve, dayChoices, pnlOn, priceRange, valueOn } from './pnl';

const call = { kind: 'call' as const, strike: 100, exp: '2026-11-20' };
const put = { kind: 'put' as const, strike: 100, exp: '2026-11-20' };

describe('estimated P&L', () => {
  it('at expiration is intrinsic value minus what you paid, x100 per contract', () => {
    expect(pnlOn(call, 3, 2, 110, '2026-11-20', 0.3)).toBe((10 - 3) * 200);
    expect(pnlOn(call, 3, 2, 90, '2026-11-20', 0.3)).toBe(-600); // the most you can lose
    expect(pnlOn(put, 4, 1, 90, '2026-11-21', 0.3)).toBe(600);
    expect(breakeven(call, 3)).toBe(103);
    expect(breakeven(put, 4)).toBe(96);
  });
  it('before expiration uses the same model price as the server', () => {
    expect(valueOn(call, 105, '2026-10-12', 0.3)).toBe(quote('call', 105, 100, '2026-11-20', '2026-10-12', 0.3).mid);
    expect(pnlOn(call, 3, 1, 105, '2026-10-12', 0.3)).toBeCloseTo((quote('call', 105, 100, '2026-11-20', '2026-10-12', 0.3).mid - 3) * 100, 6);
  });
  it('the chart range covers the stock, the strike and the breakeven', () => {
    const [lo, hi] = priceRange(50, { kind: 'call', strike: 80, exp: '2026-11-20' }, 1);
    expect(lo).toBeLessThanOrEqual(35);
    expect(hi).toBeGreaterThanOrEqual(81 * 1.1 - 1e-9);
    const pts = curve(call, 3, 1, '2026-11-20', 0.3, [80, 120], 40);
    expect(pts).toHaveLength(41);
    expect(pts[0]).toEqual({ S: 80, pnl: -300 });
    expect(pts[40]!.pnl).toBe((20 - 3) * 100);
  });
  it('the date slider runs from today to expiration', () => {
    expect(dayChoices('2026-11-17', '2026-11-20')).toEqual(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    expect(dayChoices('2026-11-21', '2026-11-20')).toEqual(['2026-11-20']);
  });
});
