import { describe, expect, it } from 'vitest';
import { contractId, expirations, label, markValue, parseContract, quote, strikes, type Kind } from './model';
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
