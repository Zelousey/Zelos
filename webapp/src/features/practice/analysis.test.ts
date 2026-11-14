import { describe, expect, it } from 'vitest';
import { analyze } from './analysis';
import type { Valued } from './account';

const row = (sym: string, dayChange: number | null, pnl: number, value = 1000) => ({ sym, qty: 1, avg: 1, openedDay: null, last: 1, value, pnl, pnlPct: pnl / 10, dayChange });
const v = (rows: ReturnType<typeof row>[], optionRows: Valued['optionRows'] = []): Valued => ({ equity: 10_100, stockValue: 0, buyingPower: 0, openPnl: 0, dayPnl: rows.reduce((t, r) => t + (r.dayChange ?? 0), 0), netPnl: 0, rows, optionValue: 0, optionRows });

describe('analyze', () => {
  it('nothing to explain without holdings', () => {
    expect(analyze(v([]))).toBeNull();
  });
  it('finds what added the most and what dragged the most today', () => {
    const a = analyze(v([row('NVDA', 84, 120), row('TSLA', -31, -50), row('AAPL', 12, 5)]))!;
    expect(a.lead?.sym).toBe('NVDA');
    expect(a.drag?.sym).toBe('TSLA');
    expect(a.movers.map((m) => m.sym)).toEqual(['NVDA', 'TSLA', 'AAPL']);
    expect(a.day).toBe(65);
    expect(a.bestOpen?.name).toBe('NVDA');
    expect(a.worstOpen?.name).toBe('TSLA');
  });
  it('no drag when everything is up, and stocks without a day change are left out', () => {
    const a = analyze(v([row('NVDA', 10, 10), row('MSFT', null, 3)]))!;
    expect(a.drag).toBeNull();
    expect(a.movers.map((m) => m.sym)).toEqual(['NVDA']);
  });
});
