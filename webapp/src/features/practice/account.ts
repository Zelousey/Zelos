/**
 * Reading the server practice account (practiceAccounts/{uid}) for display.
 *
 * The server owns every number that matters (functions/practice.py). These helpers only
 * value it on screen with the latest quotes, the same way the server does, so what you see
 * matches the leaderboard. Nothing computed here is ever sent back as truth.
 */
import { collection, limit, onSnapshot, orderBy, query, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useLiveDoc } from '../../data/liveDoc';
import type { Quote } from '../../data/markets';
import { db } from '../../lib/firebase';
import { contractId, label as optLabel, markValue, parseContract, volFor, type Contract, type Vols } from '../options/model';

export const START_CASH = 10000;
export const RESET_BELOW = 2500;

export type Position = { sym: string; qty: number; avg: number; openedDay: string | null };
export type OptionPosition = Contract & { id: string; qty: number; avg: number; label: string };
/** `opt` is set on option orders: the contract id; `sym` is then the underlying stock. */
export type Order = { id: string; sym: string; opt: string | null; label: string | null; est: number; side: 'buy' | 'sell'; type: 'market' | 'limit' | 'stop'; qty: number; limit: number | null; stop: number | null; tif: 'day' | 'gtc'; session: string; createdAt: number; bracket: { sl: number | null; tp: number | null } | null; role: 'sl' | 'tp' | null; oco: string | null };
export type Account = { cash: number; positions: Position[]; options: OptionPosition[]; orders: Order[]; realized: number; resets: number; resetHistory: { equityBefore: number }[]; publicProfile: boolean; archivedClassic: boolean; stats: { trades: number; wins: number; losses: number }; peak: number; updatedAt: number; hist: DayValue[] };
/** One New York day's closing account value (server: practice.py, kept 90 days). */
export type DayValue = { day: string; e: number };
export type HistoryItem = { id: string; kind: 'order' | 'fill' | 'trade'; at: number; sym: string; opt?: string; label?: string; side?: string; qty?: number; price?: number; pnl?: number; pct?: number; status?: string; note?: string; type?: string; role?: string | null; fillPrice?: number; entry?: number; exit?: number };

const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function parseAccount(d: DocumentData): Account {
  const positions = Object.entries((d.positions as Record<string, Record<string, unknown>>) ?? {})
    .map(([sym, p]) => ({ sym, qty: n(p.qty), avg: n(p.avg), openedDay: typeof p.openedDay === 'string' ? p.openedDay : null }))
    .filter((p) => p.qty > 0)
    .sort((a, b) => a.sym.localeCompare(b.sym));
  const options = Object.entries((d.options as Record<string, Record<string, unknown>>) ?? {})
    .flatMap(([id, p]) => {
      const c = parseContract(id);
      const qty = n(p.qty);
      return c && qty > 0 ? [{ ...c, id: contractId(c), qty, avg: n(p.avg), label: typeof p.label === 'string' ? p.label : optLabel(c) }] : [];
    })
    .sort((a, b) => a.u.localeCompare(b.u) || a.exp.localeCompare(b.exp) || a.strike - b.strike);
  const orders = Object.values((d.orders as Record<string, Record<string, unknown>>) ?? {})
    .map((o) => ({
      id: String(o.id),
      sym: String(o.sym),
      opt: typeof o.opt === 'string' ? o.opt : null,
      label: typeof o.label === 'string' ? o.label : null,
      est: n(o.est),
      side: o.side === 'sell' ? 'sell' : 'buy',
      type: o.type === 'limit' || o.type === 'stop' ? o.type : 'market',
      qty: n(o.qty),
      limit: typeof o.limit === 'number' ? o.limit : null,
      stop: typeof o.stop === 'number' ? o.stop : null,
      tif: o.tif === 'gtc' ? 'gtc' : 'day',
      session: String(o.session ?? ''),
      createdAt: n(o.createdAt),
      bracket: o.bracket && typeof o.bracket === 'object' ? { sl: n((o.bracket as Record<string, unknown>).sl, NaN) || null, tp: n((o.bracket as Record<string, unknown>).tp, NaN) || null } : null,
      role: o.role === 'sl' || o.role === 'tp' ? o.role : null,
      oco: typeof o.oco === 'string' ? o.oco : null,
    }) as Order)
    .sort((a, b) => b.createdAt - a.createdAt);
  const st = (d.stats as Record<string, unknown>) ?? {};
  return {
    cash: n(d.cash),
    positions,
    options,
    orders,
    realized: n(d.realized),
    resets: n(d.resets),
    resetHistory: Array.isArray(d.resetHistory) ? (d.resetHistory as Record<string, unknown>[]).map((r) => ({ equityBefore: n(r.equityBefore, START_CASH) })) : [],
    publicProfile: d.publicProfile !== false,
    archivedClassic: !!d.archivedClassic,
    stats: { trades: n(st.trades), wins: n(st.wins), losses: n(st.losses) },
    peak: n(d.peak, START_CASH),
    updatedAt: n(d.updatedAt),
    hist: Object.entries((d.hist as Record<string, Record<string, unknown>>) ?? {})
      .flatMap(([k, v]) => (/^d\d{8}$/.test(k) && typeof v?.e === 'number' && v.e > 0 ? [{ day: `${k.slice(1, 5)}-${k.slice(5, 7)}-${k.slice(7, 9)}`, e: v.e }] : []))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export type Valued = {
  equity: number;
  stockValue: number;
  buyingPower: number;
  openPnl: number;
  dayPnl: number;
  netPnl: number;
  rows: (Position & { last: number; value: number; pnl: number; pnlPct: number; dayChange: number | null })[];
  optionValue: number;
  optionRows: (OptionPosition & { mark: number; value: number; pnl: number; pnlPct: number; expired: boolean })[];
};

/** Value the account with the latest quotes (same rule as the server: missing price → cost;
 * option contracts at the model mid, x100 shares each, intrinsic once expired). */
export function valueAccount(a: Account, quotes: Record<string, Quote>, today: string, vols?: Vols | null): Valued {
  let stockValue = 0;
  let openPnl = 0;
  let dayPnl = 0;
  const rows = a.positions.map((p) => {
    const q = quotes[p.sym];
    const last = q?.c ?? p.avg;
    const value = p.qty * last;
    const pnl = (last - p.avg) * p.qty;
    // today's change: from the previous close, or from your cost if you bought today
    const base = p.openedDay === today ? p.avg : (q?.pc ?? null);
    const dayChange = base != null ? (last - base) * p.qty : null;
    stockValue += value;
    openPnl += pnl;
    if (dayChange != null) dayPnl += dayChange;
    return { ...p, last, value, pnl, pnlPct: p.avg ? (last / p.avg - 1) * 100 : 0, dayChange };
  });
  let optionValue = 0;
  const optionRows = a.options.map((p) => {
    const mark = markValue(p, quotes[p.u]?.c, volFor(vols, p.u), today);
    const value = mark * 100 * p.qty;
    optionValue += value;
    return { ...p, mark, value, pnl: (mark - p.avg) * 100 * p.qty, pnlPct: p.avg ? (mark / p.avg - 1) * 100 : 0, expired: p.exp < today };
  });
  const reserved = a.orders.filter((o) => o.side === 'buy').reduce((t, o) => t + (o.opt ? o.est : o.qty * (o.limit ?? o.stop ?? quotes[o.sym]?.c ?? 0)), 0);
  const equity = a.cash + stockValue + optionValue;
  const netPnl = equity - START_CASH + a.resetHistory.reduce((t, r) => t + (r.equityBefore - START_CASH), 0);
  return { equity, stockValue, buyingPower: Math.max(0, a.cash - reserved), openPnl, dayPnl, netPnl, rows, optionValue, optionRows };
}

/** Shares you can still sell (bracket exits don't hold shares back, like on the server). */
export function sellableShares(a: Account, sym: string): number {
  const held = a.positions.find((p) => p.sym === sym)?.qty ?? 0;
  const reserved = a.orders.filter((o) => o.side === 'sell' && o.sym === sym && !o.oco && !o.opt).reduce((t, o) => t + o.qty, 0);
  return Math.max(0, held - reserved);
}

/** Contracts you can still sell (not already in an open sell order). */
export function sellableContracts(a: Account, id: string): number {
  const held = a.options.find((p) => p.id === id)?.qty ?? 0;
  const reserved = a.orders.filter((o) => o.side === 'sell' && o.opt === id).reduce((t, o) => t + o.qty, 0);
  return Math.max(0, held - reserved);
}

export function usePracticeAccount(uid: string | null) {
  return useLiveDoc(uid ? `practiceAccounts/${uid}` : null, parseAccount);
}

export function useArchive(uid: string | null, enabled: boolean) {
  return useLiveDoc(uid && enabled ? `practiceArchive/${uid}` : null, (d) => ({ equity: typeof d.equity === 'number' ? d.equity : null, trades: Array.isArray(d.trades) ? d.trades.length : 0 }));
}

/** Last 40 history events (closed orders, fills, trades), newest first. */
export function usePracticeHistory(uid: string | null) {
  const [state, setState] = useState<{ uid: string | null; items: HistoryItem[]; ready: boolean }>({ uid: null, items: [], ready: false });
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db(), 'practiceAccounts', uid, 'history'), orderBy('at', 'desc'), limit(40));
    return onSnapshot(
      q,
      (snap) => setState({ uid, ready: true, items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryItem, 'id'>) })) }),
      () => setState({ uid, ready: true, items: [] }),
    );
  }, [uid]);
  return state.uid === uid ? state : { uid, items: [], ready: false };
}
