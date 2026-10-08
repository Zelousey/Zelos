/**
 * Market data for the app: typed readers for the public, read-only `markets/*` docs that
 * the scheduled Cloud Functions write from Marketstack (functions/main.py, functions/mdata.py).
 * This is the ONLY market-data source the app uses; there is no provider key here.
 *
 *   markets/quotes        live quotes for the Zelos stock list (every minute in market hours)
 *   markets/movers        gainers / losers / most active / sector averages (stock list only)
 *   markets/snapshot      end-of-day index ETFs + sectors + 1-month sparklines (JSON string)
 *   markets/intraday_SYM  intraday bars (1-minute, or 15-minute on the Basic plan), last 5 sessions
 *   markets/historyIndex  + history_<n>: ~2 years of daily bars (JSON strings)
 */
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLiveDoc } from './liveDoc';

export type Quote = { c: number; o: number; h: number; l: number; pc: number | null; t: number; v: number; chPct: number | null };
export type QuotesDoc = { quotes: Record<string, Quote>; marketOpen: boolean; updatedAt: string | null; source: string; error: string | null; every: number | null; interval: string | null };
export type Mover = { sym: string; name: string; price: number | null; chPct: number | null };
export type MoversDoc = { gainers: Mover[]; losers: Mover[]; actives: Mover[]; sectors: { sector: string; chPct: number }[]; updatedAt: string | null; scope: string };
export type SnapshotItem = { sym: string; label: string; price: number; prev: number; chg: number; pct: number | null; asOf: string };
export type SnapshotDoc = { items: Record<string, SnapshotItem>; groups: { tape: string[]; indices: string[]; sectors: string[] }; spark: Record<string, { label: string; points: { d: string; c: number }[] }>; sourceShort: string };
/** [date "YYYY-MM-DD" or "YYYY-MM-DD HH:MM", open, high, low, close, volume] */
export type Bar = [string, number, number, number, number, number];

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;

export function parseQuote(raw: unknown): Quote | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const c = num(r.c);
  if (c == null || c <= 0) return null;
  const pc = num(r.pc);
  const chPct = num(r.chPct) ?? (pc ? Math.round((c / pc - 1) * 10000) / 100 : null);
  return { c, o: num(r.o) ?? c, h: num(r.h) ?? c, l: num(r.l) ?? c, pc, t: num(r.t) ?? 0, v: num(r.v) ?? 0, chPct };
}

export function parseQuotesDoc(d: DocumentData): QuotesDoc {
  const quotes: Record<string, Quote> = {};
  for (const [sym, q] of Object.entries((d.quotes as Record<string, unknown>) ?? {})) {
    const p = parseQuote(q);
    if (p && SYMBOL_RE.test(sym)) quotes[sym] = p;
  }
  return { quotes, marketOpen: !!d.marketOpen, updatedAt: str(d.updatedAt), source: str(d.source) ?? '', error: str(d.error), every: num(d.every), interval: str(d.interval) };
}

function parseMovers(list: unknown): Mover[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.sym === 'string' && SYMBOL_RE.test(x.sym))
    .map((x) => ({ sym: x.sym as string, name: str(x.name) ?? (x.sym as string), price: num(x.price), chPct: num(x.chPct) }));
}

export function parseMoversDoc(d: DocumentData): MoversDoc {
  const sectors = Array.isArray(d.sectors) ? (d.sectors as Record<string, unknown>[]).filter((s) => typeof s.sector === 'string' && num(s.chPct) != null).map((s) => ({ sector: s.sector as string, chPct: num(s.chPct)! })) : [];
  return { gainers: parseMovers(d.gainers), losers: parseMovers(d.losers), actives: parseMovers(d.actives), sectors, updatedAt: str(d.updatedAt), scope: str(d.scope) ?? '' };
}

export function parseSnapshotDoc(d: DocumentData): SnapshotDoc {
  const j = JSON.parse(String(d.json ?? '{}')) as Partial<SnapshotDoc>;
  return { items: j.items ?? {}, groups: { tape: j.groups?.tape ?? [], indices: j.groups?.indices ?? [], sectors: j.groups?.sectors ?? [] }, spark: j.spark ?? {}, sourceShort: j.sourceShort ?? 'Marketstack' };
}

/** "YYYY-MM-DD[ HH:MM],o,h,l,c,v" strings → bars, skipping malformed rows and impossible
 *  prices (zero or negative: the provider has sent bars with a $0 low/close). */
export function parseBarStrings(rows: unknown): Bar[] {
  if (!Array.isArray(rows)) return [];
  const out: Bar[] = [];
  for (const r of rows) {
    const p = String(r).split(',');
    if (p.length < 5) continue;
    const [d, o, h, l, c, v] = [p[0]!, +p[1]!, +p[2]!, +p[3]!, +p[4]!, +(p[5] ?? 0) || 0];
    if (!/^\d{4}-\d{2}-\d{2}/.test(d) || ![o, h, l, c].every((x) => Number.isFinite(x) && x > 0)) continue;
    out.push([d, o, h, l, c, v]);
  }
  return out;
}

export const useQuotes = () => useLiveDoc('markets/quotes', parseQuotesDoc);
export const useMovers = () => useLiveDoc('markets/movers', parseMoversDoc);
export const useSnapshot = () => useLiveDoc('markets/snapshot', parseSnapshotDoc);
export const useIntraday = (sym: string | null) => useLiveDoc(sym && SYMBOL_RE.test(sym) ? `markets/intraday_${sym}` : null, (d) => parseBarStrings(d.bars));

/** ~2 years of daily bars for every chartable symbol. Read once per session (5 small doc reads), then cached. */
let historyPromise: Promise<Record<string, Bar[]>> | null = null;
export function loadHistory(): Promise<Record<string, Bar[]>> {
  if (!historyPromise) {
    historyPromise = (async () => {
      const idx = await getDoc(doc(db(), 'markets', 'historyIndex'));
      const parts = Math.min(20, Math.max(0, Number(idx.data()?.parts) || 0));
      const docs = await Promise.all(Array.from({ length: parts }, (_, i) => getDoc(doc(db(), 'markets', `history_${i}`))));
      const out: Record<string, Bar[]> = {};
      for (const d of docs) {
        const blob = JSON.parse(String(d.data()?.json ?? '{}')) as Record<string, unknown[]>;
        for (const [sym, rows] of Object.entries(blob)) {
          if (!SYMBOL_RE.test(sym) || !Array.isArray(rows)) continue;
          out[sym] = parseBarStrings(rows.filter((r): r is unknown[] => Array.isArray(r) && r.length >= 5 && typeof r[0] === 'string').map((r) => r.join(',')));
        }
      }
      return out;
    })().catch((e) => {
      historyPromise = null; // allow a retry
      throw e;
    });
  }
  return historyPromise;
}
