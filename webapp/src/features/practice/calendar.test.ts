import { describe, expect, it } from 'vitest';
import type { HistoryItem } from './account';
import { dayActivity, dayChanges, monthGrid, shortMoney, summarize } from './calendar';

const hist = [
  { day: '2026-11-02', e: 10_000 },
  { day: '2026-11-03', e: 10_600 },
  { day: '2026-11-04', e: 10_200 },
  { day: '2026-11-05', e: 10_000 }, // a reset day: not a $200 loss
  { day: '2026-11-06', e: 10_150 },
];

describe('profit calendar (owner 2026-11-19)', () => {
  it('a day is the change from the day before; a reset day is not counted', () => {
    expect(dayChanges(hist, ['2026-11-05'])).toEqual({ '2026-11-03': 600, '2026-11-04': -400, '2026-11-06': 150 });
  });
  it('lays the month out in Sunday-to-Saturday weeks with trades and today live', () => {
    const trades = [{ id: 'a', kind: 'trade', at: 0, sym: 'AMD', closeDay: '2026-11-03', pnl: 600 } as HistoryItem];
    const weeks = monthGrid(2026, 11, dayChanges(hist, ['2026-11-05']), ['2026-11-05'], trades, '2026-11-09', 75);
    expect(weeks[0]![0]!.day).toBe('2026-11-01'); // Nov 1 2026 is a Sunday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const cells = weeks.flat();
    const get = (d: string) => cells.find((c) => c.day === d)!;
    expect(get('2026-11-03')).toMatchObject({ pnl: 600, trades: 1, inMonth: true, weekend: false });
    expect(get('2026-11-05')).toMatchObject({ pnl: null, reset: true });
    expect(get('2026-11-09')).toMatchObject({ pnl: 75, today: true });
    expect(get('2026-11-01').weekend).toBe(true);
    expect(cells[cells.length - 1]!.inMonth).toBe(false); // the last week runs into December
  });
  it('sums the month: total, green and red days, best and worst', () => {
    const s = summarize(monthGrid(2026, 11, dayChanges(hist, []), [], [], '2026-12-01', null));
    expect(s.total).toBe(150);
    expect([s.green, s.red]).toEqual([2, 2]);
    expect(s.best!.day).toBe('2026-11-03');
    expect(s.worst!.day).toBe('2026-11-04');
  });
  it('picks one day’s trades and fills', () => {
    const items = [
      { id: 't', kind: 'trade', at: 1, sym: 'AMD', closeDay: '2026-11-03' },
      { id: 'f', kind: 'fill', at: Date.parse('2026-11-03T15:00:00Z'), sym: 'AMD' },
      { id: 'g', kind: 'fill', at: Date.parse('2026-11-04T15:00:00Z'), sym: 'NVDA' },
    ] as HistoryItem[];
    const r = dayActivity(items, '2026-11-03', (ms) => new Date(ms).toISOString().slice(0, 10));
    expect([r.trades.length, r.fills.map((f) => f.sym)]).toEqual([1, ['AMD']]);
  });
  it('short amounts for small squares', () => {
    expect([shortMoney(600), shortMoney(-400), shortMoney(1234), shortMoney(-25_600), shortMoney(0)]).toEqual(['+$600', '−$400', '+$1.2K', '−$26K', '$0']);
  });
});
