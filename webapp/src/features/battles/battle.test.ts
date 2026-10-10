import { describe, expect, it } from 'vitest';
import type { Quote, QuotesDoc } from '../../data/markets';
import { allowedSymbols, liveEquity, onClock, parseAccount, parseBattle, parseBook, standings, stormNow, tradable } from './battle';

const q = (c: number): Quote => ({ c, pc: c, o: c, h: c, l: c, t: 0, v: 0, chPct: null });
const doc = (open: boolean, agoS: number): QuotesDoc => ({ quotes: {}, marketOpen: open, updatedAt: new Date(1_000_000_000 - agoS * 1000).toISOString(), source: 'x', error: null, every: null, interval: null });

describe('battles', () => {
  it('trades only during market hours on fresh prices (same as the server)', () => {
    expect(tradable(doc(true, 30), 1_000_000_000)).toEqual({ ok: true, why: null });
    expect(tradable(doc(false, 30), 1_000_000_000).why).toBe('closed');
    expect(tradable(doc(true, 181), 1_000_000_000).why).toBe('stale');
    expect(tradable(null, 1).ok).toBe(false);
  });

  it('snake draft order like tw_draft_on_clock', () => {
    const d = { order: ['a', 'b', 'c'], per: 2, picks: {}, taken: [], turn: 0, total: 6, deadline: 0 };
    expect([0, 1, 2, 3, 4, 5, 6].map((turn) => onClock({ ...d, turn }))).toEqual(['a', 'b', 'c', 'c', 'b', 'a', null]);
  });

  it('reads a match, its accounts and your book', () => {
    const b = parseBattle('abcdefghijkl', {
      name: 'Friday fight', host: 'h', buyIn: 1000, days: 3, status: 'active', players: ['h', 'p'], names: { h: 'Hal', p: 'Pat' },
      lms: { floorPct: 10 }, modes: { draft: { picks: 2 }, whale: { capPct: 50, shields: 1 }, storms: 'rare', bounties: true, stops: true },
      rules: { symbols: ['AAPL', 'MSFT'] }, draft: { order: ['h', 'p'], per: 2, picks: { h: ['NVDA', 'AAPL'], p: ['MSFT'] }, taken: [], turn: 3, total: 4, deadline: 0 },
      storm: { kind: 'halt', start: 10, end: 20, sym: 'AAPL' }, bounties: [{ id: 'b1', by: 'h', target: 'p', amount: 50, status: 'open' }],
    });
    expect(b.modes).toMatchObject({ draft: { picks: 2 }, whale: { capPct: 50, shields: 1 }, storms: 'rare', bounties: true, stops: true });
    expect(allowedSymbols(b, 'h')).toEqual(['AAPL', 'NVDA']); // your draft picks
    expect(stormNow(b.storm, 15)?.sym).toBe('AAPL');
    expect(stormNow(b.storm, 25)).toBeNull();
    const plain = parseBattle('abcdefghijkl', { status: 'weird', rules: { symbols: ['AAPL', 'BTC'] } });
    expect(plain.status).toBe('lobby');
    expect(allowedSymbols(plain, 'x')).toEqual(['AAPL']); // the squad list, Zelos stocks only
    const book = parseBook({ positions: { AAPL: { qty: 2, avg: 100, sl: 90 }, X: { qty: 0, avg: 1 } }, fills: [{ sym: 'AAPL', side: 'buy', qty: 2, price: 100, at: 1 }] });
    expect(book.positions).toEqual([{ sym: 'AAPL', qty: 2, avg: 100, sl: 90, tp: null }]);
    expect(liveEquity(800, book.positions, { AAPL: q(110) })).toBe(1020);
  });

  it('standings: players still in by % gain, then the knocked out by place', () => {
    const b = parseBattle('abcdefghijkl', { status: 'active', players: ['a', 'b', 'c', 'd'] });
    const rows = standings(
      [
        parseAccount('a', { pnlPct: 2, pnl: 20 }),
        parseAccount('b', { pnlPct: 5, pnl: 50 }),
        parseAccount('c', { pnlPct: 9, out: true, place: 4 }),
        parseAccount('d', { pnlPct: -1, out: true, place: 3 }),
      ],
      b,
    );
    expect(rows.map((r) => [r.uid, r.rank])).toEqual([['b', 1], ['a', 2], ['d', 3], ['c', 4]]);
  });
});
