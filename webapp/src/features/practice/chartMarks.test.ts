import { describe, expect, it } from 'vitest';
import { chartMarks, drawdownMark, tradeMarks } from './chartMarks';
import type { HistoryItem } from './account';
import { dayNum } from './valueSeries';

const day = (d: string, v: number) => ({ t: dayNum(d), v, label: d });
const pts = [day('2026-11-02', 10000), day('2026-11-03', 10600), day('2026-11-04', 10100), day('2026-11-05', 9800), day('2026-11-06', 10400)];
const trade = (id: string, closeDay: string, pnl: number): HistoryItem => ({ id, kind: 'trade', at: Date.parse(closeDay + 'T20:00:00Z'), sym: 'AAPL', pnl, pct: pnl / 10, closeDay, entry: 100, exit: 100 + pnl / 5, qty: 5 });

describe('chart markers', () => {
  it('top winners and losers in the range, at their day on the line', () => {
    const tr = [trade('a', '2026-11-03', 120), trade('b', '2026-11-04', -80), trade('c', '2026-11-05', 5), trade('d', '2026-11-05', 30), trade('e', '2026-11-06', 60), trade('old', '2026-10-01', 999)];
    const m = tradeMarks(tr, pts, '1M', '2026-11-06');
    expect(m.filter((x) => x.kind === 'win').map((x) => x.title)).toEqual(['Closed AAPL +$120.00 (+12.0%)', 'Closed AAPL +$60.00 (+6.0%)', 'Closed AAPL +$30.00 (+3.0%)']);
    expect(m.find((x) => x.kind === 'loss')?.v).toBe(10100);
    expect(m.some((x) => x.title.includes('999'))).toBe(false); // outside the range
  });
  it('the biggest drop from a high, only when it is real and big enough', () => {
    const d = drawdownMark(pts, '1M')!;
    expect(d.title).toBe('Biggest drop: −7.5%'); // 10,600 → 9,800
    expect(d.v).toBe(9800);
    expect(drawdownMark([day('2026-11-02', 10000), day('2026-11-03', 9900)], '1M')).toBeNull();
  });
  it('options switch kinds off', () => {
    const tr = [trade('a', '2026-11-03', 120), trade('b', '2026-11-04', -80)];
    expect(chartMarks(tr, pts, '1M', '2026-11-06', { wins: false, losses: true, drawdown: false }).map((m) => m.kind)).toEqual(['loss']);
  });
});
