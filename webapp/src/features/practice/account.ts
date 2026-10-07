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

export const START_CASH = 10000;
export const RESET_BELOW = 2500;

export type Position = { sym: string; qty: number; avg: number; openedDay: string | null };
export type Order = { id: string; sym: string; side: 'buy' | 'sell'; type: 'market' | 'limit' | 'stop'; qty: number; limit: number | null; stop: number | null; tif: 'day' | 'gtc'; session: string; createdAt: number; bracket: { sl: number | null; tp: number | null } | null; role: 'sl' | 'tp' | null; oco: string | null };
export type Account = { cash: number; positions: Position[]; orders: Order[]; realized: number; resets: number; resetHistory: { equityBefore: number }[]; publicProfile: boolean; archivedClassic: boolean; stats: { trades: number; wins: number; losses: number }; peak: number; updatedAt: number };
export type HistoryItem = { id: string; kind: 'order' | 'fill' | 'trade'; at: number; sym: string; side?: string; qty?: number; price?: number; pnl?: number; pct?: number; status?: string; note?: string; type?: string; role?: string | null; fillPrice?: number; entry?: number; exit?: number };

const n = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function parseAccount(d: DocumentData): Account {
  const positions = Object.entries((d.positions as Record<string, Record<string, unknown>>) ?? {})
    .map(([sym, p]) => ({ sym, qty: n(p.qty), avg: n(p.avg), openedDay: typeof p.openedDay === 'string' ? p.openedDay : null }))
    .filter((p) => p.qty > 0)
    .sort((a, b) => a.sym.localeCompare(b.sym));
  const orders = Object.values((d.orders as Record<string, Record<string, unknown>>) ?? {})
    .map((o) => ({
      id: String(o.id),
      sym: String(o.sym),
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
    orders,
    realized: n(d.realized),
    resets: n(d.resets),
    resetHistory: Array.isArray(d.resetHistory) ? (d.resetHistory as Record<string, unknown>[]).map((r) => ({ equityBefore: n(r.equityBefore, START_CASH) })) : [],
    publicProfile: d.publicProfile !== false,
    archivedClassic: !!d.archivedClassic,
    stats: { trades: n(st.trades), wins: n(st.wins), losses: n(st.losses) },
    peak: n(d.peak, START_CASH),
    updatedAt: n(d.updatedAt),
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
};

/** Value the account with the latest quotes (same rule as the server: missing price → cost). */
export function valueAccount(a: Account, quotes: Record<string, Quote>, today: string): Valued {
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
  const reserved = a.orders.filter((o) => o.side === 'buy').reduce((t, o) => t + o.qty * (o.limit ?? o.stop ?? quotes[o.sym]?.c ?? 0), 0);
  const equity = a.cash + stockValue;
  const netPnl = equity - START_CASH + a.resetHistory.reduce((t, r) => t + (r.equityBefore - START_CASH), 0);
  return { equity, stockValue, buyingPower: Math.max(0, a.cash - reserved), openPnl, dayPnl, netPnl, rows };
}

/** Shares you can still sell (bracket exits don't hold shares back, like on the server). */
export function sellableShares(a: Account, sym: string): number {
  const held = a.positions.find((p) => p.sym === sym)?.qty ?? 0;
  const reserved = a.orders.filter((o) => o.side === 'sell' && o.sym === sym && !o.oco).reduce((t, o) => t + o.qty, 0);
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
