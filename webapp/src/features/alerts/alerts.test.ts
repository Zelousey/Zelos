import { describe, expect, it } from 'vitest';
import { hasTrade, isClosedForUnlock, isOn, isShort, parseAlert, parsePrefs, payoffAt, toggle, trackRecord, type Leg } from './alerts';

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
    expect(toggle(none, 's:breakout-rider', false)).toEqual({ notificationPrefs: { strategies: ['momentum-trader', 'momentum-max', 'swing-trader', 'options-scanner', 'three-leg'] } });
    expect(toggle(none, 'friends', false)).toEqual({ notificationPrefs: { types: { friends: false } } });
    const p = parsePrefs({ notificationPrefs: { strategies: ['options-scanner', 'evil'], types: { friends: false, x: 'no' } } });
    expect(p).toEqual({ strategies: ['options-scanner'], types: { friends: false } });
    expect(isOn(p, 's:swing-trader')).toBe(false);
    expect(isOn(p, 'friends')).toBe(false);
  });
  it('3-Leg alerts: three valid legs or none', () => {
    const legs = [
      { type: 'call', side: 'buy', strike: 180, qty: 1, price: 6 },
      { type: 'call', side: 'sell', strike: 190, qty: 2, price: 2.5 },
      { type: 'call', side: 'buy', strike: 200, qty: 1, price: 0.8 },
    ];
    const a = parseAlert('three-leg-x', { strategy: 'three-leg', status: 'qualified', ticker: 'AAPL', kindLabel: 'Bull call butterfly', expiration: '2026-11-20', legs, netCost: 180, maxProfit: 820, maxLoss: 180, breakevens: [181.8, 198.2] })!;
    expect(a).toMatchObject({ kindLabel: 'Bull call butterfly', expiration: '2026-11-20', netCost: 180, maxProfit: 820, maxLoss: 180, breakevens: [181.8, 198.2] });
    expect(a.legs).toHaveLength(3);
    expect(parseAlert('three-leg-y', { strategy: 'three-leg', ticker: 'AAPL', legs: legs.slice(0, 2), expiration: 'soon' })).toMatchObject({ legs: [], expiration: null });
    expect(parseAlert('three-leg-z', { strategy: 'three-leg', ticker: 'AAPL', legs: [...legs.slice(0, 2), { type: 'stock', side: 'buy', strike: 1, qty: 1, price: 1 }] })!.legs).toEqual([]);
  });
});

describe('3-Leg payoff (same numbers as functions/three_leg.py)', () => {
  const at = (legs: Leg[], cost: number, pts: number[]) => pts.map((p) => Math.round(payoffAt(legs, cost, p) * 100) / 100);
  const pts = [150, 170, 180, 185, 190, 195, 200, 230];
  it('bull call butterfly: a tent over the middle strike', () => {
    const legs: Leg[] = [
      { type: 'call', side: 'buy', strike: 180, qty: 1, price: 6 },
      { type: 'call', side: 'sell', strike: 190, qty: 2, price: 2.5 },
      { type: 'call', side: 'buy', strike: 200, qty: 1, price: 0.8 },
    ];
    expect(at(legs, 180, pts)).toEqual([-180, -180, -180, 320, 820, 320, -180, -180]);
  });
  it('bear put butterfly: the same tent, built from puts', () => {
    const legs: Leg[] = [
      { type: 'put', side: 'buy', strike: 200, qty: 1, price: 7 },
      { type: 'put', side: 'sell', strike: 190, qty: 2, price: 3 },
      { type: 'put', side: 'buy', strike: 180, qty: 1, price: 1 },
    ];
    expect(at(legs, 200, pts)).toEqual([-200, -200, -200, 300, 800, 300, -200, -200]);
  });
  it('jade lizard: a credit, with the risk below the short put', () => {
    const legs: Leg[] = [
      { type: 'put', side: 'sell', strike: 170, qty: 1, price: 3 },
      { type: 'call', side: 'sell', strike: 195, qty: 1, price: 2.2 },
      { type: 'call', side: 'buy', strike: 200, qty: 1, price: 1 },
    ];
    expect(at(legs, -420, pts)).toEqual([-1580, 420, 420, 420, 420, 420, -80, -80]);
  });
});

import { sharesFor } from './decisions';
import { strategyBoard } from './StrategyBoard';
import { STRATEGIES } from '../strategies/strategies';
describe('take a trade and the scoreboard (owner 2026-11-19)', () => {
  it('shares risk about 1% of the account, never more than a quarter of it in one idea', () => {
    expect(sharesFor(10_000, 50, 49)).toBe(50); // $100 risk at $1 a share = 100 shares, capped by $2,500 / $50
    expect(sharesFor(10_000, 50, 48)).toBe(50);
    expect(sharesFor(10_000, 50, 45)).toBe(20); // $5 risk a share: 20 shares
    expect(sharesFor(10_000, 50, 50)).toBe(1);
  });
  it('the scoreboard puts the best win rate first', () => {
    const mk = (strategy: string, result: string) => ({ ...parseAlert(`${strategy}-2026-11-1${Math.floor(Math.random() * 9)}`, { strategy, status: 'qualified', ticker: 'AMD', outcome: { result } })! });
    const list = [mk('swing-trader', 'hit-target'), mk('swing-trader', 'stopped-out'), mk('momentum-trader', 'hit-target'), mk('momentum-trader', 'hit-target')];
    const rows = strategyBoard(list, STRATEGIES);
    expect(rows[0]!.st.id).toBe('momentum-trader');
    expect(rows[0]!.rec.winRate).toBe(100);
    expect(rows[1]!.st.id).toBe('swing-trader');
  });
});
