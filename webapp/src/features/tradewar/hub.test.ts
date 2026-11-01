import { describe, expect, it } from 'vitest';
import { sectionFor } from './hub';

describe('sectionFor', () => {
  it('maps hub paths and ignores the rest', () => {
    expect(sectionFor('/trade-war')).toBe('overview');
    expect(sectionFor('/trade-war/overview/')).toBe('overview');
    expect(sectionFor('/trade-war/solo')).toBe('solo');
    expect(sectionFor('/battles')).toBe('battle');
    expect(sectionFor('/battles/abc')).toBe(null); // a battle room is not a hub page
    expect(sectionFor('/social')).toBe('battle'); // squads are part of Battle
    expect(sectionFor('/war')).toBe('war');
    expect(sectionFor('/war/abc')).toBe(null); // a War Zone's map is not a hub page
    expect(sectionFor('/leaderboard')).toBe('leaderboards');
    expect(sectionFor('/strategies')).toBe('strategies');
    expect(sectionFor('/dashboard')).toBe(null);
  });
});
