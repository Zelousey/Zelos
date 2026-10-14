import { describe, expect, it } from 'vitest';
import { isStale, parseResearch, researchPath } from './research';

describe('research', () => {
  it('reads the SEC research doc and ignores the retired source', () => {
    const r = parseResearch({ symbol: 'MSFT', name: 'Microsoft Corp', source: 'SEC EDGAR', fetchedAt: 100, profile: { industry: 'Services-Prepackaged Software', exchange: 'Nasdaq', website: 'http://bad', fiscalYearEnd: '0630', state: 'WA', price: 400 }, financials: { year: '2025', revenue: 2.8e11, netIncome: 1e11, eps: 13.5 }, metrics: { pe: 29.6, margin: 0.36 }, insiders: [{ date: '2026-10-01', who: 'Jane Doe', role: 'CFO', buy: false, shares: 1000, price: 401.5 }] });
    expect(r?.profile?.website).toBe(''); // only https links
    expect(r?.financials?.eps).toBe(13.5);
    expect(r?.insiders[0]).toMatchObject({ who: 'Jane Doe', buy: false, shares: 1000 });
    expect(parseResearch({ symbol: 'MSFT', source: 'FMP' })).toBeNull();
  });
  it('knows when to ask the server again and where the doc lives', () => {
    expect(isStale(null)).toBe(true);
    const r = parseResearch({ source: 'SEC EDGAR', fetchedAt: 1_000_000 })!;
    expect(isStale(r, 1_000_000 + 3600)).toBe(false);
    expect(isStale(r, 1_000_000 + 13 * 3600)).toBe(true);
    expect(researchPath('BRK.B')).toBe('markets/research_BRK-B');
  });
});
