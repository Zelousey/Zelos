import { describe, expect, it } from 'vitest';
import { parseBarStrings, parseMoversDoc, parseQuote, parseQuotesDoc, parseSnapshotDoc } from './markets';
import { marketStatus } from './marketStatus';
import { bySpeed, instrument, retiredInstrument, searchUniverse, UNIVERSE } from './universe';

describe('market data parsing', () => {
  it('quotes: keeps valid ones, derives change, drops junk', () => {
    const d = parseQuotesDoc({ source: 'marketstack', marketOpen: true, updatedAt: '2026-10-07T10:00:00-04:00', every: 15, quotes: { AAPL: { c: 110, o: 100, h: 111, l: 99, pc: 100, t: 1 }, BAD: { c: 'x' }, 'not a sym': { c: 1 } } });
    expect(Object.keys(d.quotes)).toEqual(['AAPL']);
    expect(d.quotes.AAPL!.chPct).toBe(10);
    expect(d.marketOpen).toBe(true);
    expect(parseQuote({ c: 0 })).toBeNull();
    expect(parseQuote({ c: 5, stale: true })?.stale).toBe(true);
    expect(parseQuote({ c: 5 })?.stale).toBe(false);
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
    // a provider bar with a $0 low/close is dropped instead of drawing a spike to zero
    expect(parseBarStrings(['2026-06-04,145.63,146.37,0.0,0.0,40483209', '2026-06-05,146,147,145,146.5,1'])).toEqual([['2026-06-05', 146, 147, 145, 146.5, 1]]);
  });
});

describe('market status line', () => {
  const base = { quotes: {}, source: 'marketstack', error: null, every: 15, everySlow: null, interval: '15m', paused: null };
  it('open, with freshness and source', () => {
    const now = Date.parse('2026-10-07T14:10:00Z');
    const st = marketStatus({ ...base, marketOpen: true, updatedAt: '2026-10-07T14:01:00Z' }, now);
    expect(st.open).toBe(true);
    expect(st.text).toBe('Market open · updated 9 minutes ago · updates every 15 min · Marketstack');
    expect(st.stale).toBe(false);
  });
  it('1-minute prices: says every minute and goes stale after a few missed updates', () => {
    const now = Date.parse('2026-10-07T14:10:00Z');
    const fresh = marketStatus({ ...base, every: 1, interval: '1m', marketOpen: true, updatedAt: '2026-10-07T14:09:00Z' }, now);
    expect(fresh.text).toBe('Market open · updated 1 minute ago · updates every minute · Marketstack');
    expect(fresh.stale).toBe(false);
    expect(marketStatus({ ...base, every: 1, interval: '1m', marketOpen: true, updatedAt: '2026-10-07T14:01:00Z' }, now).stale).toBe(true);
  });
  it('closed shows the time prices are from, in ET', () => {
    expect(marketStatus({ ...base, marketOpen: false, updatedAt: '2026-10-06T20:10:00Z' }).text).toMatch(/^Market closed · prices as of 4:10 PM EDT · Marketstack$/);
  });
  it('two speeds: day trading every minute, long-term every 15 min', () => {
    const now = Date.parse('2026-10-07T14:10:00Z');
    const st = marketStatus({ ...base, every: 1, everySlow: 15, interval: '1m', marketOpen: true, updatedAt: '2026-10-07T14:09:00Z' }, now);
    expect(st.text).toBe('Market open · updated 1 minute ago · day trading every minute, long-term every 15 min · Marketstack');
  });
  it('our data-plan cap says until when', () => {
    const d = parseQuotesDoc({ source: 'marketstack', marketOpen: true, updatedAt: '2026-10-07T14:09:00Z', paused: { reason: 'cycle', until: '2026-11-07' }, quotes: {} });
    expect(d.paused).toEqual({ reason: 'cycle', until: '2026-11-07' });
    expect(marketStatus(d).text).toBe('Live prices paused until Nov 7 (data plan limit) · showing last prices');
    expect(marketStatus({ ...d, paused: { reason: 'day', until: null } }).text).toMatch(/paused for today/);
    expect(parseQuotesDoc({ paused: { reason: 'x' }, quotes: {} }).paused).toBeNull();
  });
  it('a feed error is said plainly', () => {
    expect(marketStatus({ ...base, marketOpen: true, updatedAt: null, error: 'auth' }).text).toMatch(/paused/);
  });
});

describe('universe', () => {
  it('is bundled, excludes paused crypto, and searches by symbol or name', () => {
    expect(UNIVERSE.length).toBe(28);
    expect(UNIVERSE.some((s) => s.group === 'Crypto')).toBe(false);
    expect(instrument('aapl')?.name).toBe('Apple');
    expect(searchUniverse('nvi').map((s) => s.sym)).toContain('NVDA');
    expect(searchUniverse('MS').map((s) => s.sym)).toEqual(expect.arrayContaining(['MSFT']));
  });
  it('day-trading stocks are the 8 fast ones; removed stocks are kept apart', () => {
    expect(bySpeed(true).map((s) => s.sym).sort()).toEqual(['AAPL', 'AMD', 'AMZN', 'META', 'MSFT', 'NVDA', 'QQQ', 'SPY']);
    expect(bySpeed(false).length).toBe(20);
    expect(instrument('AVGO')).toBeUndefined();
    expect(retiredInstrument('avgo')).toMatchObject({ sym: 'AVGO', retired: true });
    expect(retiredInstrument('AAPL')).toBeUndefined();
  });
});
