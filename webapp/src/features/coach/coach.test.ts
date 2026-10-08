import { describe, expect, it } from 'vitest';
import { parseInvite } from '../invites/invites';
import { COACH_MIN_XP, MAX_STUDENTS, parseCoaching, parseNote, parseSummary, parseTask, TASK_XP } from './coach';

describe('coach', () => {
  it('matches the server limits (functions/coaching.py, functions/xp.py)', () => {
    expect(COACH_MIN_XP).toBe(150);
    expect(MAX_STUDENTS).toBe(5);
    expect(TASK_XP).toEqual({ trade: 10, win: 15, analyze: 10, grade: 10, news: 5, custom: 5 });
  });
  it('reads a coaching and its summary defensively', () => {
    const c = parseCoaching('c_s', {
      coach: 'c', student: 's', coachName: 'Ada', status: 'active', tasksDone: 2,
      summary: { xp: 40, level: 1, equity: 10250, trades: [{ id: 'trade0001', sym: 'AAPL', side: 'short', pnl: -12.5, pct: -1.2, at: 9 }, { id: 'x', pnl: 'lots' }, null] },
    });
    expect(c).toMatchObject({ id: 'c_s', coachName: 'Ada', studentName: 'Trader', status: 'active', tasksDone: 2 });
    expect(c?.summary?.trades).toEqual([{ id: 'trade0001', sym: 'AAPL', side: 'short', qty: null, entry: null, exit: null, pnl: -12.5, pct: -1.2, at: 9 }]);
    expect(parseCoaching('x', { coach: 'c', student: 's', status: 'weird' })?.status).toBe('ended');
    expect(parseCoaching('x', { coach: 'c' })).toBeNull();
    expect(parseSummary('nope')).toBeNull();
  });
  it('tasks: known kinds and statuses only', () => {
    expect(parseTask('t1', { kind: 'win', n: 3, label: 'Close 3 winning trades', progress: 1, status: 'open', dueAt: 5 })).toMatchObject({ kind: 'win', n: 3, progress: 1, status: 'open' });
    expect(parseTask('t1', { kind: 'free-xp', status: 'open' })).toBeNull();
    expect(parseTask('t1', { kind: 'trade', status: 'paid' })).toBeNull();
  });
  it('notes: reactions and trades are checked', () => {
    expect(parseNote('n1', { from: 'c', fromName: 'Ada', role: 'coach', text: 'Nice exit', reaction: 'good', trade: { sym: 'TSLA', pnl: 40, pct: 2 }, at: 3 })).toMatchObject({ role: 'coach', reaction: 'good', trade: { sym: 'TSLA', pnl: 40, pct: 2 } });
    expect(parseNote('n1', { from: 's', reaction: 'evil', trade: 'x' })).toMatchObject({ role: 'student', reaction: null, trade: null, fromName: 'Someone' });
    expect(parseNote('n1', {})).toBeNull();
  });
  it('a coach invite parses', () => {
    expect(parseInvite('Abcdefgh23')({ kind: 'coach', from: 'u1', fromName: 'Ada', status: 'open' })).toMatchObject({ kind: 'coach', fromName: 'Ada' });
  });
});
