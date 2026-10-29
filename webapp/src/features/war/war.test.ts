import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapSize, parseWar } from './lobby';
import { parseIntel, parsePlacement, placementProblem } from './map';
import { chaosNow, chartBars, COMPANIES, HOT_MS, parseBars, parseChaos, parseProfile, parseQuotes, QUIET_MAX_MIN, quietLength, SECTORS, warEquity } from './war';

describe('War zone', () => {
  it('lists the same made-up companies and sectors as the server (functions/warmarket.py)', () => {
    const py = readFileSync(resolve(__dirname, '../../../../functions/warmarket.py'), 'utf8');
    const rows = [...py.matchAll(/\("([A-Z]{5})", "([^"]+)", "([a-z]+)", [\d.]+, [\d.]+\)/g)].map((m) => ({ sym: m[1], name: m[2], sector: m[3] }));
    expect(rows).toEqual(COMPANIES);
    const block = py.slice(py.indexOf('SECTORS = ('), py.indexOf('# (sym, name'));
    const secs = [...block.matchAll(/\("([a-z]+)", "([A-Za-z ]+)"\)/g)].map((m) => [m[1], m[2]]);
    expect(secs).toEqual(SECTORS.map(([a, b]) => [a, b]));
  });
  it('groups 5-minute bars into chart bars, moving the last with the newest price', () => {
    const M = 60000;
    const raw = parseBars({ bars: [0, 5, 10, 15, 20].map((m, i) => ({ t: m * M, o: 10 + i, h: 12 + i, l: 9 + i, c: 11 + i })).concat([{ t: 'x' } as never]) });
    const out = chartBars(raw, 15, 30);
    expect(out).toHaveLength(2);
    expect(out[0]!.slice(1)).toEqual([10, 14, 9, 13, 0]);
    expect(out[1]!.slice(1)).toEqual([13, 30, 12, 30, 0]);
    expect(out[0]![0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
  it('reads the War profile and values it at War zone prices', () => {
    const p = parseProfile({ start: 100000, cash: 98000, positions: { NIMBC: { qty: 10, avg: 200 }, AAPL: { qty: 5, avg: 1 }, VOLTX: { qty: 0, avg: 1 } }, chart: [{ t: 1, eq: 100000 }, [2, 3]], trades: 1 });
    expect(p.positions).toEqual([{ sym: 'NIMBC', qty: 10, avg: 200 }]);
    expect(p.chart).toEqual([{ t: 1, eq: 100000 }]);
    const q = parseQuotes({ updatedAt: 5, prices: { NIMBC: { p: 210, ref: 200 }, FAKE: { p: 1 } } });
    expect(Object.keys(q.prices)).toEqual(['NIMBC']);
    expect(warEquity(p, q.prices)).toBe(100100);
    expect(warEquity(p, {})).toBe(100000); // no price: valued at cost
  });
  it('shows a Chaos warning, then the live banner, then Hot stocks for a day', () => {
    expect(parseChaos({ phase: 'secret', scopeName: 'Energy', startsAt: 1 })).toBeNull();
    const warned = parseChaos({ phase: 'warned', scope: 'energy', scopeName: 'Energy', startsAt: 1000, moves: { VOLTX: 0.1 } })!;
    expect(warned).not.toHaveProperty('moves');
    expect(chaosNow(warned, 0)).toEqual({ banner: 'warned', hot: new Set() });
    expect(chaosNow(warned, 1000).banner).toBe('live'); // the start time passed before the next server update
    const live = parseChaos({ phase: 'live', scope: 'energy', scopeName: 'Energy', startsAt: 1000, endsAt: 5000, syms: ['VOLTX', 'PETRA', 'AAPL'] })!;
    expect(chaosNow(live, 2000)).toEqual({ banner: 'live', hot: new Set(['VOLTX', 'PETRA']) });
    expect(chaosNow(live, 5000).banner).toBeNull();
    const over = parseChaos({ phase: 'over', scope: 'energy', scopeName: 'Energy', startsAt: 1000, endsAt: 5000, syms: ['VOLTX'], hotUntil: 5000 + HOT_MS })!;
    expect(chaosNow(over, 6000)).toEqual({ banner: null, hot: new Set(['VOLTX']) });
    expect(chaosNow(over, 5000 + HOT_MS).hot.size).toBe(0);
  });
  it('measures quiet hours across midnight and reads them from the profile', () => {
    expect(quietLength({ start: 1320, end: 480 })).toBe(600);
    expect(quietLength({ start: 60, end: 360 })).toBe(300);
    expect(quietLength({ start: 1320, end: 495 }) > QUIET_MAX_MIN).toBe(true);
    expect(parseProfile({ quiet: { start: 1320, end: 480, tz: 'Europe/London' } }).quiet).toEqual({ start: 1320, end: 480, tz: 'Europe/London' });
    expect(parseProfile({ quiet: { start: 'x' } }).quiet).toBeNull();
  });
  it('reads a private War and sizes its map like the server', () => {
    expect(parseWar('w1', { status: 'secret' })).toBeNull();
    const w = parseWar('w1', { status: 'lobby', stage: 'ready', organizer: 'a', players: ['a', 'b', 3], names: { a: 'Ann', b: 7 }, ready: { a: true, b: 'yes' }, invited: ['c'], days: 5 })!;
    expect(w.players).toEqual(['a', 'b']);
    expect(w.names).toEqual({ a: 'Ann' });
    expect(w.ready).toEqual({ a: true, b: false });
    expect([w.days, w.maxPlayers, w.soldiers]).toEqual([5, 10, 100]);
    expect([2, 3, 4, 6, 7, 10].map(mapSize)).toEqual([6, 6, 8, 8, 10, 10]);
    const py = readFileSync(resolve(__dirname, '../../../../functions/warlobby.py'), 'utf8');
    expect(py).toContain('DAYS = (1, 2, 3, 5, 7)');
    expect(py).toContain('LOBBY_HOURS = (1, 6, 24)');
  });
  it('reads your placement and warnings, and checks a placement like the server', () => {
    const T = ['tech', 'finance', 'health', 'energy', 'consumer', 'comms'];
    expect(parsePlacement({ soldiers: { tech: 50, mars: 3, health: -1 }, camo: ['tech', 'mars'], locked: true })).toEqual({ soldiers: { tech: 50 }, camo: ['tech'], locked: true, auto: false, reserve: 0, picks: {} });
    expect(parseIntel({ warnings: { tech: 'heavy', energy: 'enemy', health: 12, mars: 'enemy' } })).toEqual({ tech: 'heavy', energy: 'enemy' });
    expect(placementProblem({ soldiers: { tech: 50, energy: 50 }, camo: [] }, T, 100)).toBeNull();
    expect(placementProblem({ soldiers: { tech: 50, energy: 45 }, camo: ['energy'] }, T, 100)).toBeNull();
    expect(placementProblem({ soldiers: { tech: 60, energy: 40 }, camo: [] }, T, 100)?.key).toBe('over');
    expect(placementProblem({ soldiers: { tech: 50, energy: 30 }, camo: [] }, T, 100)).toEqual({ key: 'left', n: 20 });
    expect(placementProblem({ soldiers: { tech: 20, finance: 20, health: 20, energy: 20, consumer: 10, comms: 10 }, camo: [] }, T, 100)?.key).toBe('empty');
    expect(placementProblem({ soldiers: { tech: 50, energy: 45 }, camo: ['health'] }, T, 100)?.key).toBe('camo');
  });
  it('reads contested battles, bonus points and Redeploy passes from the War', () => {
    const w = parseWar('w1', {
      status: 'active',
      players: ['a', 'b'],
      bonusPoints: { a: 1, b: 'x' },
      redeployPasses: { b: 1 },
      battles: {
        tech: { kind: 'duel', players: ['a', 'b'], command: 'a', stage: 'running', sym: 'NIMBC', sides: { a: 'bear', b: 'bull', c: 'sideways' }, start: { NIMBC: 100 }, endsAt: 5 },
        energy: { stage: 'secret' },
      },
    })!;
    expect(Object.keys(w.battles)).toEqual(['tech']);
    expect(w.battles.tech!.sides).toEqual({ a: 'bear', b: 'bull' });
    expect([w.bonusPoints, w.redeployPasses]).toEqual([{ a: 1 }, { b: 1 }]);
    expect(parsePlacement({ reserve: 5, picks: { tech: { side: 'bull', sym: 'NIMBC' }, mars: { side: 'bull', sym: 'X' } } })).toMatchObject({ reserve: 5, picks: { tech: { side: 'bull', sym: 'NIMBC' } } });
  });
});
