import { describe, expect, it } from 'vitest';
import { parseRanked } from '../dashboard/social';
import { boardField } from './board';
import { monthKey, seasonFor, weekKey } from './periods';

describe('leaderboard', () => {
  it('week keys match the server (Python isocalendar)', () => {
    // values printed by Python: datetime.date.fromisoformat(d).isocalendar()
    const expected: Record<string, string> = {
      '2026-10-09': 'w2026_41', '2026-01-01': 'w2026_01', '2027-01-01': 'w2026_53', '2026-12-31': 'w2026_53',
      '2026-12-28': 'w2026_53', '2025-12-29': 'w2026_01', '2027-01-03': 'w2026_53', '2026-06-15': 'w2026_25',
    };
    for (const [d, k] of Object.entries(expected)) expect(weekKey(d)).toBe(k);
    expect(monthKey('2026-10-09')).toBe('m2026_10');
    expect(seasonFor('2026-10-09')?.id).toBe('s1');
    expect(seasonFor('2027-02-01')?.id).toBe('s2');
    expect(seasonFor('2026-09-01')).toBeNull();
  });
  it('each board sorts by the right field', () => {
    expect(boardField('all', 'pct', '2026-10-09').path).toBe('equity');
    expect(boardField('week', 'pct', '2026-10-09').path).toBe('p.w2026_41.pct');
    expect(boardField('month', 'pct', '2026-10-09').path).toBe('p.m2026_10.pct');
    expect(boardField('season', 'bestWin', '2026-10-09').path).toBe('p.s1.bestWin');
    const r = parseRanked('u1', { equity: 12000, xp: 300, p: { w2026_41: { pct: 4.2, pnl: 420, junk: 'x' }, 'bad key': { pct: 1 } } })!;
    expect(r.p).toEqual({ w2026_41: { pct: 4.2, pnl: 420 } });
    expect(boardField('week', 'pct', '2026-10-09').value(r)).toBe(4.2);
    expect(boardField('month', 'pct', '2026-10-09').value(r)).toBeNull();
    expect(r).toMatchObject({ xp: 300, netPnl: 2000, username: null });
  });
});
