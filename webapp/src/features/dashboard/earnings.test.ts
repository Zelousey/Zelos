import { describe, expect, it } from 'vitest';
import { pickReports } from './Earnings';

const r = (sym: string, date: string) => ({ sym, date, eps: null });
describe('pickReports', () => {
  it('yours first, soonest first, past dates dropped', () => {
    const p = pickReports([r('NVDA', '2026-11-19'), r('AAPL', '2026-11-12'), r('MSFT', '2026-11-17'), r('ZZZZ', '2026-11-16')], ['NVDA', 'AAPL', 'MSFT'], '2026-11-14');
    expect(p.yours).toBe(true);
    expect(p.list.map((x) => x.sym)).toEqual(['MSFT', 'NVDA']);
  });
  it('none of yours: the Zelos list, never unknown symbols', () => {
    const p = pickReports([r('NVDA', '2026-11-19'), r('ZZZZ', '2026-11-16')], ['TSLA'], '2026-11-14');
    expect(p.yours).toBe(false);
    expect(p.list.map((x) => x.sym)).toEqual(['NVDA']);
  });
});
