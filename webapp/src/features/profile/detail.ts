/**
 * The Trade War numbers on a public profile: the rest of practiceProfiles/{uid}, written by the
 * server (functions/practice.py build_profile). Parsed together with the leaderboard row
 * (dashboard/social.ts parseRanked) because liveDoc keeps one parser per document.
 */
import type { DocumentData } from 'firebase/firestore';

export type BestTrade = { sym: string; label: string; invested: number; pnl: number; pct: number; entry: number | null; exit: number | null; openDay: string | null; closeDay: string | null };
export type ProfileDetail = {
  start: number;
  peakEquity: number;
  resets: number;
  resetHistory: { day: string; equityBefore: number }[];
  wins: number;
  losses: number;
  realized: number;
  avgWin: number;
  avgLoss: number;
  winStreakBest: number;
  virtualTrades: number;
  bestTrades: BestTrade[];
  mostTraded: { sym: string; trades: number; pnl: number }[];
  topStocks: { sym: string; pnl: number }[];
  streak: number;
  since: number | null;
};

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const sym = (v: unknown) => (typeof v === 'string' ? v.replace(/[^A-Za-z0-9.:\-/ ]/g, '').slice(0, 24) : '');
const dayStr = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const rows = (v: unknown, max: number) => (Array.isArray(v) ? (v as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').slice(0, max) : []);

export function parseDetail(d: DocumentData): ProfileDetail {
  const equity = num(d.equity, 10000);
  return {
    start: num(d.start, 10000),
    peakEquity: Math.max(num(d.peakEquity, equity), equity),
    resets: Math.max(0, Math.floor(num(d.resets))),
    resetHistory: rows(d.resetHistory, 20).flatMap((r) => {
      const day = dayStr(r.day);
      return day ? [{ day, equityBefore: num(r.equityBefore) }] : [];
    }),
    wins: Math.max(0, Math.floor(num(d.wins))),
    losses: Math.max(0, Math.floor(num(d.losses))),
    realized: num(d.realized),
    avgWin: num(d.avgWin),
    avgLoss: num(d.avgLoss),
    winStreakBest: Math.max(0, Math.floor(num(d.winStreakBest))),
    virtualTrades: Math.max(0, Math.floor(num(d.virtualTrades, num(d.trades)))),
    bestTrades: rows(d.bestTrades, 10).flatMap((t) => {
      const s = sym(t.sym);
      return s ? [{ sym: s, label: sym(t.label) || s, invested: num(t.invested), pnl: num(t.pnl), pct: num(t.pct), entry: numOrNull(t.entry), exit: numOrNull(t.exit), openDay: dayStr(t.openDay), closeDay: dayStr(t.closeDay) }] : [];
    }),
    mostTraded: rows(d.mostTraded, 5).flatMap((t) => (sym(t.sym) ? [{ sym: sym(t.sym), trades: Math.max(0, Math.floor(num(t.trades))), pnl: num(t.pnl) }] : [])),
    topStocks: rows(d.topStocks, 5).flatMap((t) => (sym(t.sym) ? [{ sym: sym(t.sym), pnl: num(t.pnl) }] : [])),
    streak: Math.max(0, Math.floor(num(d.streak))),
    since: numOrNull(d.since),
  };
}
