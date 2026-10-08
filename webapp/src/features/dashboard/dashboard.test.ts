import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXCHANGES, exchangeStatus } from '../../data/exchanges';
import { LEVELS, levelFor } from '../../data/levels';
import { parseUserDoc } from '../../data/userDoc';
import { ACHIEVEMENTS, achievementsView, DAILY, mergeProgress, missionsView, nyDate, parseProgress, weekKey, WEEKLY } from './progress';
import { parseRanked, parseWar, sortWars } from './social';

const root = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('kept in step with the website and the server', () => {
  it('exchange hours match the classic globe', () => {
    const js = read('zelos-globe.js');
    for (const x of EXCHANGES) {
      const line = js.split('\n').find((l) => l.includes(`id: '${x.id}'`));
      expect(line, x.id).toBeDefined();
      expect(line).toContain(`tz: '${x.tz}'`);
      expect(line).toContain(`s: ${JSON.stringify(x.s).replace(/,/g, ', ')}`);
    }
    expect((js.match(/\{ id: '[A-Z0-9]+', name:/g) ?? []).length).toBe(EXCHANGES.length);
  });
  it('levels match zelos-levels.js and functions/practice.py', () => {
    const js = read('zelos-levels.js');
    const py = read('functions/practice.py');
    for (const l of LEVELS) {
      expect(js).toContain(`name: '${l.name}'`);
      expect(js).toMatch(new RegExp(`level: ${l.level}, xp: ${l.xp},\\s+name: '${l.name}',\\s+title: '${l.title}'`));
      expect(py).toContain(`(${l.level}, ${l.xp}, "${l.name}")`);
    }
  });
  it('missions and achievements pay what the server allows (functions/xp.py)', () => {
    const py = read('functions/xp.py');
    const table = (name: string) => Object.fromEntries([...(py.match(new RegExp(`${name} = \\{([^}]*)\\}`))![1]!.matchAll(/"([\w-]+)": (\d+)/g))].map((m) => [m[1], +m[2]!]));
    expect(Object.fromEntries(DAILY.map((m) => [m.id, m.xp]))).toEqual(table('DAILY_MISSIONS'));
    expect(Object.fromEntries(WEEKLY.map((m) => [m.id, m.xp]))).toEqual(table('WEEKLY_MISSIONS'));
    const base = ACHIEVEMENTS.filter((a) => !a.id.startsWith('season-'));
    expect(Object.fromEntries(base.map((a) => [a.id, a.xp]))).toEqual(table('ACHIEVEMENTS'));
    expect(ACHIEVEMENTS).toHaveLength(29);
  });
});

describe('exchanges', () => {
  const nyse = EXCHANGES.find((x) => x.id === 'NYSE')!;
  const tse = EXCHANGES.find((x) => x.id === 'TSE')!;
  it('open, pre-open, lunch, closed and weekends', () => {
    expect(exchangeStatus(nyse, new Date('2026-10-07T14:00:00Z')).open).toBe(true); // 10:00 ET Wed
    expect(exchangeStatus(nyse, new Date('2026-10-07T13:00:00Z')).label).toBe('Pre-open · opens 09:30 local');
    expect(exchangeStatus(nyse, new Date('2026-10-07T21:00:00Z')).label).toBe('Closed · opens 09:30 local');
    expect(exchangeStatus(nyse, new Date('2026-10-10T15:00:00Z')).label).toBe('Closed for the weekend');
    expect(exchangeStatus(tse, new Date('2026-10-07T03:00:00Z')).label).toBe('Lunch break · opens 12:30 local'); // 12:00 Tokyo
  });
});

describe('levels', () => {
  it('turns XP into a level and progress', () => {
    expect(levelFor(0).level.name).toBe('Getting started');
    const g = levelFor(275);
    expect(g.level.name).toBe('Gold');
    expect(g.next?.name).toBe('Platinum');
    expect(g.toNext).toBe(125);
    expect(g.progress).toBeCloseTo(0.5);
    expect(levelFor(99999)).toMatchObject({ next: null, progress: 1 });
    expect(levelFor(Number.NaN).level.level).toBe(0);
  });
});

describe('progress', () => {
  const now = Date.parse('2026-10-08T15:00:00Z'); // Thu 11:00 ET
  const today = nyDate(now);
  const raw = { v: 1, updatedAt: 5, day: { date: today, counts: { trade: 1, analyze: 2 }, done: { trade: true } }, week: { key: weekKey(today), counts: { trade: 4 }, done: {} }, streak: { days: 3, best: 5, lastDate: nyDate(now, -1) }, achievements: { 'first-trade': 100 } };

  it('reads the classic shape and rejects junk', () => {
    expect(parseProgress({ v: 2 })).toBeNull();
    expect(parseProgress('x')).toBeNull();
    const p = parseProgress({ v: 1, day: { counts: { trade: 'lots' }, done: { trade: 'yes' } }, achievements: { x: -1 } })!;
    expect(p.day.counts.trade).toBe(0);
    expect(p.day.done).toEqual({});
  });
  it('mission view: counts, done, streak and the XP log', () => {
    expect(weekKey('2026-10-08')).toBe('w2026_41');
    const m = missionsView(parseProgress(raw), { day: { date: today, xp: 140 } }, now);
    expect(m.daily.find((x) => x.id === 'trade')).toMatchObject({ done: true, count: 1 });
    expect(m.daily.find((x) => x.id === 'analyze')).toMatchObject({ done: false, count: 2, goal: 3 });
    expect(m.daily.find((x) => x.id === 'xp')).toMatchObject({ count: 100 }); // capped at the goal
    expect(m.streak).toBe(3); // last kept yesterday: still alive
    expect(m.doneToday).toBe(1);
    // yesterday's counts don't carry over; a streak last kept two days ago is over
    const old = missionsView(parseProgress({ ...raw, day: { ...raw.day, date: nyDate(now, -1) }, streak: { days: 3, best: 5, lastDate: nyDate(now, -2) } }), {}, now);
    expect(old.daily.every((x) => x.count === 0 && !x.done)).toBe(true);
    expect(old.streak).toBe(0);
  });
  it('merges two copies like the website does', () => {
    const a = parseProgress(raw)!;
    const b = parseProgress({ ...raw, day: { date: today, counts: { trade: 0, analyze: 3 }, done: { analyze: true } }, streak: { days: 4, best: 4, lastDate: today }, achievements: { 'first-trade': 50, 'first-win': 60 } })!;
    const m = mergeProgress(a, b)!;
    expect(m.day.counts).toEqual({ trade: 1, analyze: 3 });
    expect(m.day.done).toEqual({ trade: true, analyze: true });
    expect(m.streak).toEqual({ days: 4, best: 5, lastDate: today });
    expect(m.achievements).toEqual({ 'first-trade': 50, 'first-win': 60 });
    expect(mergeProgress(null, b)).toBe(b);
  });
  it('achievements: newest first, public copy counts, next three locked', () => {
    const v = achievementsView(parseProgress(raw), ['centurion']);
    expect(v.unlocked.map((a) => a.id)).toEqual(['first-trade', 'centurion']);
    expect(v.next).toHaveLength(3);
    expect(v.next.map((a) => a.id)).not.toContain('first-trade');
  });
});

describe('user doc and social parsing', () => {
  it('user doc: XP is never negative, watchlist cleaned', () => {
    expect(parseUserDoc({ xp: -5, watchlist: ['aapl', '<x>'] })).toMatchObject({ xp: 0, watchlist: ['AAPL'], progress: null });
    expect(parseUserDoc({ xp: 1234.7 }).xp).toBe(1234);
  });
  it('leaderboard rows: only safe images, a name, a number', () => {
    expect(parseRanked('u', { name: 'A', equity: 'x' })).toBeNull();
    expect(parseRanked('u', { equity: 12000, photo: 'javascript:alert(1)' })).toMatchObject({ name: 'Trader', photo: null, growthPct: 0 });
    expect(parseRanked('u', { name: 'B', equity: 12000, photo: 'https://lh3.googleusercontent.com/a.png', growthPct: 20, level: 99 })).toMatchObject({ photo: 'https://lh3.googleusercontent.com/a.png', level: 10 });
  });
  it('trade wars: your place, cancelled ones hidden, live ones first', () => {
    const p = parseWar('me');
    expect(p('w0', { status: 'cancelled' })).toBeNull();
    const ended = p('w1', { name: 'Friday', status: 'ended', players: ['me', 'b'], results: [{ uid: 'b', rank: 1 }, { uid: 'me', rank: 2 }], createdAt: 3 })!;
    expect(ended).toMatchObject({ myRank: 2, of: 2, players: 2 });
    const live = p('w2', { name: 'Now', status: 'active', players: ['me'], createdAt: 1, endAt: 5 })!;
    const lobby = p('w3', { name: 'Soon', status: 'lobby', players: ['me'], maxPlayers: 4, createdAt: 9 })!;
    expect(sortWars([ended, lobby, live]).map((w) => w.id)).toEqual(['w2', 'w3', 'w1']);
  });
});
