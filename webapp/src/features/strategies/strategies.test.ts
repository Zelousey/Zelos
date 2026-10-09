import { describe, expect, it } from 'vitest';
import { parseAlert, parseWallet, passUntil, safeCheckout, STRATEGIES } from './strategies';

describe('strategies', () => {
  it('the same three strategies as the server', () => {
    expect(STRATEGIES.map((s) => s.id)).toEqual(['swing-trader', 'breakout-rider', 'options-scanner']);
  });
  it('alerts: real ones only, tickers hidden while locked', () => {
    const a = parseAlert('breakout-rider-2026-10-08', { strategy: 'breakout-rider', createdAt: '2026-10-08T14:00:00Z', status: 'qualified', setupLabel: 'Flat base', score: '82', scoreMax: 100, locked: true, ticker: 'NVDA' });
    expect(a).toMatchObject({ strategy: 'breakout-rider', label: 'Flat base', score: 82, scoreMax: 100, locked: true, ticker: null, at: Date.parse('2026-10-08T14:00:00Z') });
    expect(parseAlert('x', { strategy: 'swing-trader', status: 'test-deploy' })).toBeNull();
    expect(parseAlert('test-swing-pfe', { strategy: 'swing-trader', status: 'qualified' })).toBeNull();
    expect(parseAlert('x', { strategy: 'moon-bot', status: 'qualified' })).toBeNull();
    expect(parseAlert('x', { strategy: 'swing-trader', ticker: 'aapl', createdAt: { toMillis: () => 5 } })).toMatchObject({ ticker: 'aapl', at: 5, locked: false });
  });
  it('wallet: balance and passes read defensively', () => {
    const w = parseWallet({ balance: 99.7, passes: { 'swing-trader': 2000, hack: 9e15 } });
    expect(w).toEqual({ balance: 99, passes: { 'swing-trader': 2000 } });
    expect(parseWallet({ balance: -5, passes: 'x' })).toEqual({ balance: 0, passes: {} });
    expect(passUntil(w, 'swing-trader', 1000)).toBe(2000);
    expect(passUntil(w, 'swing-trader', 3000)).toBeNull();
    expect(passUntil(null, 'breakout-rider', 0)).toBeNull();
  });
  it('checkout only ever goes to an https page', () => {
    expect(safeCheckout('https://square.link/u/abc')).toBe(true);
    expect(safeCheckout('javascript:alert(1)')).toBe(false);
    expect(safeCheckout('http://evil.example/')).toBe(false);
    expect(safeCheckout(undefined)).toBe(false);
  });
});
