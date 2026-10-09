import { describe, expect, it } from 'vitest';
import { hasTrade, isClosedForUnlock, isOn, isShort, parseAlert, parsePrefs, toggle, trackRecord } from './alerts';

const base = { strategy: 'swing-trader', createdAt: '2026-10-08T14:00:00Z', status: 'qualified' };

describe('alerts', () => {
  it('reads a full alert and its outcome object', () => {
    const a = parseAlert('swing-trader-2026-10-08', { ...base, ticker: 'nvda', entry: 100, stop: '95', target1: 110, target2: 120, rewardRiskRatio: 2, direction: 'long', technicals: { RSI: 52, trend: 'up', nested: { x: 1 } }, outcome: { result: 'hit-target', exitPrice: 110.2, closedAt: 5, notes: 'T1 hit' } })!;
    expect(a).toMatchObject({ ticker: 'NVDA', entry: 100, stop: 95, result: 'hit-target', exitPrice: 110.2, outcomeNotes: 'T1 hit', locked: false });
    expect(a.technicals).toEqual([['RSI', '52'], ['trend', 'up']]);
    expect(hasTrade(a)).toBe(true);
    expect(isShort(a)).toBe(false);
  });
  it('teasers stay locked; test docs and unknown strategies are dropped', () => {
    const t = parseAlert('breakout-rider-2026-10-09', { ...base, strategy: 'breakout-rider', locked: true, lockedUntil: 1000 })!;
    expect(t).toMatchObject({ locked: true, ticker: null, lockedUntil: 1000 });
    expect(isClosedForUnlock(t, 999)).toBe(false);
    expect(isClosedForUnlock(t, 1000)).toBe(true);
    expect(isClosedForUnlock({ ...t, afterClose: true }, 0)).toBe(true);
    expect(parseAlert('test-1', base)).toBeNull();
    expect(parseAlert('x-2026-10-08', { ...base, status: 'test-deploy' })).toBeNull();
    expect(parseAlert('x-2026-10-08', { ...base, strategy: 'moon' })).toBeNull();
    expect(parseAlert('x-2026-10-08', { ...base, outcome: { result: 'jackpot' } })!.result).toBeNull();
    expect(hasTrade(parseAlert('x-2026-10-08', { ...base, status: 'no-qualifying-setup' })!)).toBe(false);
  });
  it('track record: win rate over closed trades only', () => {
    const mk = (result?: string, status = 'qualified') => parseAlert(`swing-trader-${Math.random().toString(36).slice(2)}`, { ...base, status, ticker: 'A', outcome: result ? { result } : undefined })!;
    const r = trackRecord([mk('hit-target'), mk('hit-target'), mk('stopped-out'), mk('expired'), mk('no-trade'), mk(), mk(undefined, 'no-qualifying-setup')]);
    expect(r).toEqual({ wins: 2, losses: 1, open: 1, expired: 1, noTrade: 1, winRate: 67 });
    expect(trackRecord([]).winRate).toBeNull();
  });
  it('notification switches: same fields as the website', () => {
    const none = parsePrefs({});
    expect(isOn(none, 's:swing-trader')).toBe(true);
    expect(isOn(none, 'battles')).toBe(true);
    expect(toggle(none, 's:breakout-rider', false)).toEqual({ notificationPrefs: { strategies: ['swing-trader', 'options-scanner'] } });
    expect(toggle(none, 'friends', false)).toEqual({ notificationPrefs: { types: { friends: false } } });
    const p = parsePrefs({ notificationPrefs: { strategies: ['options-scanner', 'evil'], types: { friends: false, x: 'no' } } });
    expect(p).toEqual({ strategies: ['options-scanner'], types: { friends: false } });
    expect(isOn(p, 's:swing-trader')).toBe(false);
    expect(isOn(p, 'friends')).toBe(false);
  });
});
