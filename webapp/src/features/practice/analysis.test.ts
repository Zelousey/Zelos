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

describe('your top gainers and losers (open P&L since you opened each position)', () => {
  it('ranks open stocks and options by what they are up or down overall, not today', async () => {
    const { contributors } = await import('./analysis');
    const opt = { u: 'AAPL', kind: 'call' as const, strike: 330, exp: '2099-12-18', id: 'AAPL|20991218|C|33000', qty: 1, avg: 2, label: 'AAPL $330 Call 12/18', mark: 2.4, value: 240, pnl: 40, pnlPct: 20, expired: false };
    const val = v([row('NVDA', -5, 120), row('TSLA', 8, -60), row('MSFT', 1, 15)], [opt]);
    const c = contributors(val, {}, null, '2026-11-15');
    expect(c.gainers.map((x) => x.name)).toEqual(['NVDA', 'AAPL $330 Call 12/18', 'MSFT']); // NVDA is down today but up overall
    expect(c.gainers[1]).toMatchObject({ kind: 'option', pnl: 40, today: null });
    expect(c.losers.map((x) => x.name)).toEqual(['TSLA']);
  });
});
