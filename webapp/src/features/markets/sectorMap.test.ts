import { describe, expect, it } from 'vitest';
import { UNIVERSE } from '../../data/universe';
import { heat, SECTOR_OF, stocksIn } from './sectorMap';

describe('sector map', () => {
  it('puts every Zelos stock (not ETFs) in one of the 11 sectors', () => {
    const SECTORS = ['Technology', 'Communication Services', 'Consumer Cyclical', 'Consumer Defensive', 'Financial Services', 'Healthcare', 'Energy', 'Industrials', 'Basic Materials', 'Real Estate', 'Utilities'];
    for (const i of UNIVERSE.filter((x) => x.group !== 'ETF')) expect(SECTORS).toContain(SECTOR_OF[i.sym]);
  });
  it('lists a sector’s stocks and scales the colour', () => {
    expect(stocksIn('Healthcare', ['AAPL', 'UNH', 'MRNA'])).toEqual(['UNH', 'MRNA']);
    expect(heat(1.5)).toBe(0.5);
    expect(heat(-9)).toBe(1);
  });
});
