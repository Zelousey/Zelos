import { describe, expect, it } from 'vitest';
import { parseBarStrings, parseMoversDoc, parseQuote, parseQuotesDoc, parseSnapshotDoc } from './markets';
import { marketStatus } from './marketStatus';
import { instrument, searchUniverse, UNIVERSE } from './universe';

describe('market data parsing', () => {
  it('quotes: keeps valid ones, derives change, drops junk', () => {
    const d = parseQuotesDoc({ source: 'marketstack', marketOpen: true, updatedAt: '2026-10-07T10:00:00-04:00', every: 15, quotes: { AAPL: { c: 110, o: 100, h: 111, l: 99, pc: 100, t: 1 }, BAD: { c: 'x' }, 'not a sym': { c: 1 } } });
    expect(Object.keys(d.quotes)).toEqual(['AAPL']);
    expect(d.quotes.AAPL!.chPct).toBe(10);
    expect(d.marketOpen).toBe(true);
    expect(parseQuote({ c: 0 })).toBeNull();
    expect(parseQuote(null)).toBeNull();
  });
  it('movers: drops rows with bad symbols, keeps sectors with numbers', () => {
    const m = parseMoversDoc({ gainers: [{ sym: 'NVDA', name: 'NVIDIA', price: 1, chPct: 2 }, { sym: '<x>' }], sectors: [{ sector: 'Tech', chPct: 1 }, { sector: 'X' }] });
    expect(m.gainers.map((x) => x.sym)).toEqual(['NVDA']);
    expect(m.sectors).toEqual([{ sector: 'Tech', chPct: 1 }]);
    expect(m.losers).toEqual([]);
  });
  it('snapshot: parses the JSON string with safe defaults', () => {
    expect(parseSnapshotDoc({ json: '{"items":{"SPY":{"sym":"SPY","price":1}}}' }).groups.tape).toEqual([]);
    expect(() => parseSnapshotDoc({ json: '{bad' })).toThrow();
  });
  it('bar strings: parses and skips malformed rows', () => {
    expect(parseBarStrings(['2026-10-07 09:30,1,2,0.5,1.5,100', 'garbage', '2026-10-07,1,2,x,1,1'])).toEqual([['2026-10-07 09:30', 1, 2, 0.5, 1.5, 100]]);
    expect(parseBarStrings(undefined)).toEqual([]);
  });
});

describe('market status line', () => {
  const base = { quotes: {}, source: 'marketstack', error: null, every: 15, interval: '15m' };
  it('open, with freshness and source', () => {
    const now = Date.parse('2026-10-07T14:10:00Z');
    const st = marketStatus({ ...base, marketOpen: true, updatedAt: '2026-10-07T14:01:00Z' }, now);
    expect(st.open).toBe(true);
    expect(st.text).toBe('Market open · updated 9 minutes ago · updates every 15 min · Marketstack');
    expect(st.stale).toBe(false);
  });
  it('closed shows the time prices are from, in ET', () => {
    expect(marketStatus({ ...base, marketOpen: false, updatedAt: '2026-10-06T20:10:00Z' }).text).toMatch(/^Market closed · prices as of 4:10 PM EDT · Marketstack$/);
  });
  it('a feed error is said plainly', () => {
    expect(marketStatus({ ...base, marketOpen: true, updatedAt: null, error: 'auth' }).text).toMatch(/paused/);
  });
});

describe('universe', () => {
  it('is bundled, excludes paused crypto, and searches by symbol or name', () => {
    expect(UNIVERSE.length).toBeGreaterThan(40);
    expect(UNIVERSE.some((s) => s.group === 'Crypto')).toBe(false);
    expect(instrument('aapl')?.name).toBe('Apple');
    expect(searchUniverse('nvi').map((s) => s.sym)).toContain('NVDA');
    expect(searchUniverse('MS').map((s) => s.sym)).toEqual(expect.arrayContaining(['MSFT']));
  });
});
