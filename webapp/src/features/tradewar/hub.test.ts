import { beforeEach, describe, expect, it } from 'vitest';
import { inSoloSession, noteSection, pickStart, sectionFor } from './hub';

describe('pickStart (Trade War tab routing, A > B > C)', () => {
  const cases: [boolean, number | null, string][] = [
    [true, null, 'solo'],
    [true, 0, 'solo'],
    [true, 3, 'solo'], // A wins over B
    [false, null, 'wait'],
    [false, 0, 'modes'],
    [false, 1, 'overview'],
    [false, 5, 'overview'],
  ];
  it.each(cases)('soloSession=%s active=%s → %s', (soloSession, active, want) => {
    expect(pickStart({ soloSession, active })).toBe(want);
  });
});

describe('Solo session memory', () => {
  beforeEach(() => window.sessionStorage.clear());
  it('is on after Solo, off after another section', () => {
    expect(inSoloSession()).toBe(false);
    noteSection('solo', 1000);
    expect(inSoloSession(2000)).toBe(true);
    noteSection('battle', 3000);
    expect(inSoloSession(4000)).toBe(false);
  });
  it('runs out after 2 hours and ignores junk', () => {
    noteSection('solo', 0);
    expect(inSoloSession(2 * 3600_000 - 1)).toBe(true);
    expect(inSoloSession(2 * 3600_000)).toBe(false);
    window.sessionStorage.setItem('zelosTradeWarSection', '{oops');
    expect(inSoloSession()).toBe(false);
  });
});

describe('sectionFor', () => {
  it('maps hub paths and ignores the rest', () => {
    expect(sectionFor('/trade-war')).toBe('overview');
    expect(sectionFor('/trade-war/overview/')).toBe('overview');
    expect(sectionFor('/trade-war/solo')).toBe('solo');
    expect(sectionFor('/battles')).toBe('battle');
    expect(sectionFor('/battles/abc')).toBe(null); // a battle room is not a hub page
    expect(sectionFor('/social')).toBe('squad');
    expect(sectionFor('/leaderboard')).toBe('leaderboards');
    expect(sectionFor('/strategies')).toBe('strategies');
    expect(sectionFor('/dashboard')).toBe(null);
  });
});
