import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRanked, type Ranked } from '../dashboard/social';
import { tierFor } from './GoalBar';
import { CHAT_PHOTO_MAX, cleanCode, CODE_RE, goalProgress, metric, netOn, parseMessage, parseSquad, REACTIONS, scoreSince } from './squads';

const root = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const A = 'memberAlpha0001';
const B = 'memberBravo0002';
const prof = (uid: string, d: Record<string, unknown>) => parseRanked(uid, { equity: 10000, xp: 0, ...d }) as Ranked;

describe('squads', () => {
  it('reads a squad doc and drops anything malformed', () => {
    const sq = parseSquad('sq1', {
      name: 'Tuesday Traders', owner: A, members: [A, B, '../bad'], names: { [A]: 'Al', [B]: 'Bo' }, code: 'K7QX2M',
      comp: { start: 1, end: 2, days: 7, base: { [A]: { net: 5, eq: 10005, xp: 1 } } }, goal: { text: 'Green week', target: 3, days: 7, start: 1, end: 9 },
      config: { reactions: false, photos: true, symbols: ['AAPL', 7] }, helpMode: true,
    });
    expect(sq.members).toEqual([A, B]);
    expect(sq.comp?.base[A]).toEqual({ net: 5, eq: 10005, xp: 1 });
    expect(sq.config).toEqual({ reactions: false, photos: true, viewTrades: false, symbols: ['AAPL'] });
    expect(parseSquad('x', { code: 'O0O0O0' }).code).toBeNull(); // look-alike characters are never made
  });
  it('scores like the website: % growth in net P&L since the start, frozen when it ends', () => {
    const p = prof(A, { equity: 11000, netPnl: 1000, xp: 50, h: { d20261001: { n: 200, x: 10, e: 10200 }, d20261005: { n: 600, x: 30, e: 10600 } } });
    expect(netOn(p, '2026-10-04')).toEqual({ n: 200, x: 10, e: 10200 });
    expect(netOn(p, '2026-09-30')).toBeNull();
    // still running: live net
    expect(scoreSince(p, { net: 200, eq: 10200, xp: 10 }, Date.parse('2026-12-01T12:00:00Z'), Date.parse('2026-10-09T12:00:00Z')).pnl).toBe(800);
    // ended 2026-10-05: the end-of-day snapshot, not today's number
    const done = scoreSince(p, { net: 200, eq: 10200, xp: 10 }, Date.parse('2026-10-05T20:00:00Z'), Date.parse('2026-10-09T12:00:00Z'));
    expect(done).toEqual({ pnl: 400, pct: (400 / 10200) * 100, xp: 20 });
  });
  it('ranks the boards and averages the goal', () => {
    const now = Date.parse('2026-10-09T15:00:00Z');
    const sq = parseSquad('s', { name: 'S', owner: A, members: [A, B], comp: { start: now - 864e5, end: now + 864e5, days: 7, base: { [A]: { net: 0, eq: 10000, xp: 0 } } }, goal: { text: '', target: 5, days: 7, start: now - 864e5, end: now + 6 * 864e5, base: { [A]: { net: 0, eq: 10000, xp: 0 }, [B]: { net: 100, eq: 10100, xp: 0 } } } });
    const profs = { [A]: prof(A, { equity: 10500, netPnl: 500, growthPct: 5, p: { w2026_41: { pct: 2, pnl: 200 } } }), [B]: prof(B, { equity: 10100, netPnl: 100, growthPct: 1 }) };
    expect(metric(sq, 'comp', A, profs[A], now)?.pct).toBeCloseTo(5);
    expect(metric(sq, 'week', A, profs[A], now)).toMatchObject({ pct: 2, pnl: 200 });
    expect(metric(sq, 'week', B, profs[B], now)).toMatchObject({ pct: 0, pnl: 0 });
    expect(metric(sq, 'all', B, undefined, now)).toBeNull(); // private stats
    const g = goalProgress(sq, profs, now)!;
    expect(g.avg).toBeCloseTo(2.5); // (5% + 0%) / 2
    expect(g.pct).toBeCloseTo(50);
    expect(g.done).toBe(false);
  });
  it('chat messages, codes and limits match firestore.rules', () => {
    const rules = read('firestore.rules');
    expect(rules).toContain(`['${REACTIONS.join("', '")}']`);
    expect(rules).toContain("code.matches('^[A-HJ-NP-Z2-9]{6}$')");
    expect(CODE_RE.source).toBe('^[A-HJ-NP-Z2-9]{6}$');
    expect(cleanCode(' k7qx-2m ')).toBe('K7QX2M');
    expect(CHAT_PHOTO_MAX).toBeLessThan(250000);
    expect(rules).toContain('photo.size() <= 250000');
    const m = parseMessage('m1', { author: A, name: 'Al', text: 'hi', photo: 'javascript:alert(1)', r: { [B]: 'fire', x: 'nope' } });
    expect(m).toMatchObject({ text: 'hi', photo: null, r: { [B]: 'fire' } });
    expect(parseMessage('m2', { text: 'no author' })).toBeNull();
  });
  it('the goal bar gets livelier as it fills', () => {
    expect([0, 24.9, 25, 49, 50, 74, 75, 99.9, 100, 140].map(tierFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
