import { describe, expect, it } from 'vitest';
import { rankMatches } from './TopSearch';

describe('top bar stock search', () => {
  it('puts the exact symbol first, then symbols that start with it, then names', () => {
    const r = rankMatches('amd').map((i) => i.sym);
    expect(r[0]).toBe('AMD');
    expect(rankMatches('nvi').map((i) => i.sym)).toContain('NVDA');
  });
  it('returns nothing for an empty box and at most 8 matches', () => {
    expect(rankMatches('  ')).toEqual([]);
    expect(rankMatches('a').length).toBeLessThanOrEqual(8);
  });
});
