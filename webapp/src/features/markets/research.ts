/**
 * Company research for a stock (markets/research_<SYM>, public): SEC EDGAR profile, the last
 * fiscal year's financials, P/E and net margin, and recent open-market insider trades. The
 * server keeps it (refresh_market_data, and market_research on demand, cached 12 hours and
 * capped per day).
 */
import type { DocumentData } from 'firebase/firestore';
import { useLiveDoc } from '../../data/liveDoc';
import { callFunction } from '../../lib/firebase';

export type Insider = { date: string; who: string; role: string; buy: boolean; shares: number | null; price: number | null };
export type Research = {
  symbol: string;
  name: string;
  fetchedAt: number; // seconds
  profile: { industry: string; exchange: string; website: string; fiscalYearEnd: string; state: string; price: number | null } | null;
  financials: { year: string; revenue: number | null; grossProfit: number | null; netIncome: number | null; eps: number | null } | null;
  metrics: { pe: number | null; margin: number | null };
  insiders: Insider[];
};
export const RESEARCH_MAX_AGE_S = 12 * 3600; // RESEARCH_MAX_AGE_S in functions/main.py

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.slice(0, max) : '');
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);

export function parseResearch(d: DocumentData): Research | null {
  if (d.source !== 'SEC EDGAR') return null; // older docs from a retired source are never shown
  const p = obj(d.profile);
  const f = obj(d.financials);
  const m = obj(d.metrics) ?? {};
  const site = str(p?.website, 120);
  return {
    symbol: str(d.symbol, 10),
    name: str(d.name) || str(d.symbol, 10),
    fetchedAt: num(d.fetchedAt) ?? 0,
    profile: p ? { industry: str(p.industry, 60), exchange: str(p.exchange, 20), website: site.startsWith('https://') ? site : '', fiscalYearEnd: str(p.fiscalYearEnd, 4), state: str(p.state, 4), price: num(p.price) } : null,
    financials: f ? { year: str(f.year, 8), revenue: num(f.revenue), grossProfit: num(f.grossProfit), netIncome: num(f.netIncome), eps: num(f.eps) } : null,
    metrics: { pe: num(m.pe), margin: num(m.margin) },
    insiders: Array.isArray(d.insiders)
      ? (d.insiders as unknown[]).slice(0, 6).map((x) => {
          const r = obj(x) ?? {};
          return { date: str(r.date, 10), who: str(r.who, 50), role: str(r.role, 50), buy: r.buy === true, shares: num(r.shares), price: num(r.price) };
        })
      : [],
  };
}

/** The doc id the server uses: BRK.B → research_BRK-B. */
export const researchPath = (sym: string) => `markets/research_${sym.replace('.', '-')}`;
export const useResearch = (sym: string | null) => useLiveDoc(sym ? researchPath(sym) : null, (d) => parseResearch(d));
export const fetchResearch = (symbol: string) => callFunction<{ symbol: string }, unknown>('market_research', { symbol });
/** Missing or older than the server's cache: ask the server (it writes the doc, which the page is listening to). */
export const isStale = (r: Research | null, nowS = Date.now() / 1000) => !r || nowS - r.fetchedAt > RESEARCH_MAX_AGE_S;
