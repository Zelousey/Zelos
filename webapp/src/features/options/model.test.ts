import { describe, expect, it } from 'vitest';
import { contractId, expirations, label, listedExpirations, markValue, optionable, parseContract, quote, strikes, type Kind } from './model';
import parity from './parity.json';

// parity.json is the server's own numbers (scripts/options_parity.py from functions/options.py)
describe('options model', () => {
  it('prices every contract the same as the server', () => {
    for (const [c, want] of parity.quotes as [[Kind, number, number, string, string, number], { mid: number; bid: number; ask: number; delta: number; dte: number }][]) {
      const q = quote(...c);
      expect([q.mid, q.bid, q.ask, q.dte], JSON.stringify(c)).toEqual([want.mid, want.bid, want.ask, want.dte]);
      expect(q.delta).toBeCloseTo(want.delta, 9);
    }
  });
  it('lists the same expirations and strikes', () => {
    for (const [d, want] of Object.entries(parity.expirations)) expect(expirations(d)).toEqual(want);
    for (const [s, want] of Object.entries(parity.strikes)) expect(strikes(Number(s))).toEqual(want);
  });
  it('names contracts like the server', () => {
    const c = { u: 'AAPL', kind: 'put' as const, strike: 22.5, exp: '2026-11-20' };
    expect(contractId(c)).toBe('AAPL|20261120|P|2250');
    expect(parseContract('AAPL|20261120|P|2250')).toEqual(c);
    expect(parseContract('AAPL|2026|P|1')).toBeNull();
    expect(label({ ...c, kind: 'call', strike: 250 })).toBe('AAPL $250 Call 11/20');
  });
  it('values expired contracts at intrinsic and unpriced ones at cost', () => {
    const p = { u: 'AAPL', kind: 'put' as const, strike: 115, exp: '2026-10-09', avg: 2.4 };
    expect(markValue(p, 110, 0.3, '2026-10-10')).toBe(5);
    expect(markValue(p, undefined, 0.3, '2026-10-08')).toBe(2.4);
  });
});

describe('"Today" contracts (owner 2026-11-14)', () => {
  const at = (hhmm: string) => Date.parse(`2026-11-16T${hhmm}:00-05:00`); // a Monday, New York time
  it('listed on a trading day until 30 minutes before the close, first in the list', () => {
    expect(listedExpirations('2026-11-16', at('10:00'), true)[0]).toBe('2026-11-16');
    expect(listedExpirations('2026-11-16', at('08:00'), false)[0]).toBe('2026-11-16'); // before the open
    expect(listedExpirations('2026-11-16', at('15:30'), true)).not.toContain('2026-11-16');
    expect(listedExpirations('2026-11-16', at('11:00'), false)).not.toContain('2026-11-16'); // closed all day: a holiday
    expect(listedExpirations('2026-11-15', at('11:00'), false)).not.toContain('2026-11-15'); // Sunday
  });
  it('priced on the minutes left, so it loses value through the day', () => {
    const morning = quote('call', 100, 100, '2026-11-16', '2026-11-16', 0.4, at('10:00')).mid;
    const late = quote('call', 100, 100, '2026-11-16', '2026-11-16', 0.4, at('15:45')).mid;
    const week = quote('call', 100, 100, '2026-11-20', '2026-11-16', 0.4).mid;
    expect(morning).toBeGreaterThan(late);
    expect(week).toBeGreaterThan(morning);
    // same numbers as the server (functions/options.py with now_ms and the close)
    expect(morning).toBe(0.42);
  });
  it('worth what it is in the money after the close', () => {
    expect(markValue({ u: 'AAPL', kind: 'call', strike: 100, exp: '2026-11-16', avg: 1 }, 103, 0.4, '2026-11-16', at('16:01'))).toBe(3);
  });
  it('options only on the day-trading stocks', () => {
    expect(optionable('NVDA')).toBe(true);
    expect(optionable('TSLA')).toBe(false);
  });
});
