/**
 * The Trade War realm in the app (docs/WAR_DESIGN.md §20, §24): the War zone's simulated market
 * and your War profile. Reads what the server writes (functions/warmarket.py, war_market_tick)
 * and calls war_open / war_trade; every rule is checked by the server.
 *
 *   warMarket/quotes        current prices + the price 24 hours ago (every minute)
 *   warMarket/bars_<SYM>    5-minute bars, the last 7 days
 *   warMarket/chaos         today's Chaos event once it's announced: warned / live / over (W2, §14)
 *   warProfiles/{uid}       your War profile (War balance, positions, balance chart, quiet hours)
 *
 * Hidden until all of War is built (owner 2026-10-29): only admins can open it for now.
 */
import type { DocumentData } from 'firebase/firestore';
import type { Bar } from '../../data/markets';
import { useLiveDoc } from '../../data/liveDoc';
import { callFunction } from '../../lib/firebase';

/** COMPANIES and SECTORS in functions/warmarket.py (made-up companies, real sector names; E1). */
export const SECTORS = [
  ['tech', 'Tech'],
  ['finance', 'Finance'],
  ['health', 'Health'],
  ['energy', 'Energy'],
  ['consumer', 'Consumer'],
  ['comms', 'Communication'],
  ['industrials', 'Industrials'],
  ['realestate', 'Real Estate'],
  ['materials', 'Materials'],
  ['utilities', 'Utilities'],
] as const;
export type SectorId = (typeof SECTORS)[number][0];
export type Company = { sym: string; name: string; sector: SectorId };
export const COMPANIES: Company[] = [
  { sym: 'NIMBC', name: 'Nimbus Cloud', sector: 'tech' },
  { sym: 'QUBTR', name: 'Qubitron Labs', sector: 'tech' },
  { sym: 'SYNAP', name: 'Synaptix Chips', sector: 'tech' },
  { sym: 'VAULT', name: 'Vaultline Bank', sector: 'finance' },
  { sym: 'LEDGR', name: 'Ledgerpoint Pay', sector: 'finance' },
  { sym: 'ORBCP', name: 'Orbit Capital', sector: 'finance' },
  { sym: 'HELIX', name: 'Helixa Bio', sector: 'health' },
  { sym: 'CURAM', name: 'Curamed Health', sector: 'health' },
  { sym: 'PULSV', name: 'Pulsevia Devices', sector: 'health' },
  { sym: 'VOLTX', name: 'Voltex Energy', sector: 'energy' },
  { sym: 'SOLRN', name: 'Solarion Power', sector: 'energy' },
  { sym: 'PETRA', name: 'Petravo Oil', sector: 'energy' },
  { sym: 'BRWLY', name: 'Brewly Foods', sector: 'consumer' },
  { sym: 'STRDE', name: 'Stridewear', sector: 'consumer' },
  { sym: 'CARTO', name: 'Cartopia Stores', sector: 'consumer' },
  { sym: 'SIGNL', name: 'Signalwave Media', sector: 'comms' },
  { sym: 'ECHON', name: 'Echonet Telecom', sector: 'comms' },
  { sym: 'STRMR', name: 'Streamora', sector: 'comms' },
  { sym: 'FORGE', name: 'Forgeline Industrial', sector: 'industrials' },
  { sym: 'AEROV', name: 'Aerovance', sector: 'industrials' },
  { sym: 'RAILX', name: 'Railmax Logistics', sector: 'industrials' },
  { sym: 'HAVEN', name: 'Havenstone Realty', sector: 'realestate' },
  { sym: 'BRIKX', name: 'Brickline Properties', sector: 'realestate' },
  { sym: 'TOWRS', name: 'Towerpoint Spaces', sector: 'realestate' },
  { sym: 'ALLOY', name: 'Alloycore Metals', sector: 'materials' },
  { sym: 'POLYM', name: 'Polymora Chemicals', sector: 'materials' },
  { sym: 'QUARZ', name: 'Quarzite Mining', sector: 'materials' },
  { sym: 'GRIDX', name: 'Gridwell Utilities', sector: 'utilities' },
  { sym: 'AQUAV', name: 'Aquavera Water', sector: 'utilities' },
  { sym: 'WATSN', name: 'Wattson Power', sector: 'utilities' },
];
export const BY_SYM: Record<string, Company> = Object.fromEntries(COMPANIES.map((c) => [c.sym, c]));
export const START_BALANCE = 100000;
export const QUOTE_MAX_AGE_MS = 3 * 60000; // QUOTE_MAX_AGE_MS: older prices can't be traded on

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export type WarQuote = { p: number; ref: number };
export type WarQuotes = { updatedAt: number; prices: Record<string, WarQuote> };
export function parseQuotes(d: DocumentData): WarQuotes {
  const prices: Record<string, WarQuote> = {};
  for (const [sym, v] of Object.entries(rec(d.prices))) {
    const q = rec(v);
    if (BY_SYM[sym] && num(q.p) > 0) prices[sym] = { p: num(q.p), ref: num(q.ref, num(q.p)) };
  }
  return { updatedAt: num(d.updatedAt), prices };
}

/** "YYYY-MM-DD HH:MM" in the viewer's own time (the War zone runs around the clock). */
function label(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
type Raw = [number, number, number, number, number];
export function parseBars(d: DocumentData): Raw[] {
  return (Array.isArray(d.bars) ? d.bars : [])
    .map((b: unknown) => rec(b))
    .filter((b: Record<string, unknown>) => ['t', 'o', 'h', 'l', 'c'].every((k) => typeof b[k] === 'number'))
    .map((b: Record<string, unknown>) => [b.t, b.o, b.h, b.l, b.c] as Raw);
}
/** 5-minute bars grouped into `step`-minute chart bars (the live price moves the last one). */
export function chartBars(raw: Raw[], step: number, live?: number): Bar[] {
  const out: Bar[] = [];
  let cur: Bar | null = null;
  let start = -1;
  for (const [t, o, h, l, c] of raw) {
    const s = t - (t % (step * 60000));
    if (!cur || s !== start) {
      start = s;
      cur = [label(s), o, h, l, c, 0];
      out.push(cur);
    } else {
      cur[2] = Math.max(cur[2], h);
      cur[3] = Math.min(cur[3], l);
      cur[4] = c;
    }
  }
  if (cur && live) {
    cur[4] = live;
    cur[2] = Math.max(cur[2], live);
    cur[3] = Math.min(cur[3], live);
  }
  return out;
}

/** A Chaos event (§14): the server publishes it 30 minutes ahead, never its size or direction. */
export type WarChaos = { phase: 'warned' | 'live' | 'over'; scope: string; scopeName: string; startsAt: number; endsAt: number | null; syms: string[]; hotUntil: number | null };
export function parseChaos(d: DocumentData): WarChaos | null {
  if (!['warned', 'live', 'over'].includes(d.phase) || typeof d.scopeName !== 'string' || typeof d.startsAt !== 'number') return null;
  return {
    phase: d.phase,
    scope: typeof d.scope === 'string' ? d.scope : '',
    scopeName: d.scopeName.slice(0, 40),
    startsAt: d.startsAt,
    endsAt: typeof d.endsAt === 'number' ? d.endsAt : null,
    syms: (Array.isArray(d.syms) ? d.syms : []).filter((x: unknown): x is string => typeof x === 'string' && !!BY_SYM[x]),
    hotUntil: typeof d.hotUntil === 'number' ? d.hotUntil : null,
  };
}
/** What to show now: the banner (warned or live, until it ends) and the Hot stocks (live, then a day after). */
export const HOT_MS = 24 * 3600000;
export function chaosNow(c: WarChaos | null, now: number): { banner: 'warned' | 'live' | null; hot: Set<string> } {
  if (!c) return { banner: null, hot: new Set() };
  const ended = c.phase === 'over' || (c.endsAt != null && now >= c.endsAt);
  const banner = ended ? null : c.phase === 'live' || now >= c.startsAt ? 'live' : 'warned';
  const hotTill = c.hotUntil ?? (c.endsAt != null ? c.endsAt + HOT_MS : 0);
  return { banner, hot: !ended || now < hotTill ? new Set(c.syms) : new Set() };
}

/** Quiet hours (§22): minutes after midnight in tz; start === end means off. Never longer than 10 hours. */
export type Quiet = { start: number; end: number; tz: string };
export const QUIET_MAX_MIN = 600;
export const quietLength = (q: Pick<Quiet, 'start' | 'end'>) => (((q.end - q.start) % 1440) + 1440) % 1440;
export const QUIET_TIMES = Array.from({ length: 96 }, (_, i) => i * 15);
export function clock(min: number): string {
  return new Date(2000, 0, 1, Math.floor(min / 60), min % 60).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
function parseQuiet(v: unknown): Quiet | null {
  const q = rec(v);
  const okMin = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 1440;
  return okMin(q.start) && okMin(q.end) && typeof q.tz === 'string' ? { start: q.start as number, end: q.end as number, tz: q.tz } : null;
}

export type WarPosition = { sym: string; qty: number; avg: number };
export type WarProfile = { start: number; cash: number; positions: WarPosition[]; trades: number; createdAt: number; chart: { t: number; eq: number }[]; quiet: Quiet | null };
export function parseProfile(d: DocumentData): WarProfile {
  return {
    start: num(d.start, START_BALANCE),
    cash: num(d.cash),
    positions: Object.entries(rec(d.positions))
      .map(([sym, v]) => ({ sym, qty: num(rec(v).qty), avg: num(rec(v).avg) }))
      .filter((p) => p.qty > 0 && BY_SYM[p.sym])
      .sort((a, b) => a.sym.localeCompare(b.sym)),
    trades: num(d.trades),
    createdAt: num(d.createdAt),
    quiet: parseQuiet(d.quiet),
    chart: (Array.isArray(d.chart) ? d.chart : []).map((x: unknown) => rec(x)).filter((x: Record<string, unknown>) => typeof x.t === 'number' && typeof x.eq === 'number').map((x: Record<string, unknown>) => ({ t: x.t as number, eq: x.eq as number })),
  };
}

/** Your War balance at these prices (a stock without a price counts at its cost). */
export function warEquity(p: WarProfile, prices: Record<string, WarQuote>): number {
  return p.cash + p.positions.reduce((t, x) => t + x.qty * (prices[x.sym]?.p ?? x.avg), 0);
}

export const useWarQuotes = () => useLiveDoc('warMarket/quotes', parseQuotes);
export const useWarBars = (sym: string | null) => useLiveDoc(sym && BY_SYM[sym] ? `warMarket/bars_${sym}` : null, parseBars);
export const useWarChaos = () => useLiveDoc('warMarket/chaos', parseChaos);
export const useWarProfile = (uid: string | null) => useLiveDoc(uid ? `warProfiles/${uid}` : null, parseProfile);

export const openWar = () => callFunction<{ tz: string }, { profile: DocumentData }>('war_open', { tz: browserTz() });
export const setQuiet = (q: Quiet) => callFunction<Quiet, { quiet: Quiet }>('war_quiet', q);
export type WarTradeReq = { sym: string; side: 'buy' | 'sell'; qty: number };
export const warTrade = (req: WarTradeReq) => callFunction<WarTradeReq, { fill: { price: number; qty: number; pnl: number | null } }>('war_trade', req);
