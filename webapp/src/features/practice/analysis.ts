/**
 * Why your account moved (owner 2026-11-14, like a broker's "what's moving your portfolio"):
 * today's change by stock (from the previous close, or your cost if bought today), the biggest
 * contributor and the biggest drag, and your biggest open gain and loss overall (stocks and options).
 * Pure: it only reads the valued account.
 */
import type { Quote } from '../../data/markets';
import { markValue, volFor, type Vols } from '../options/model';
import type { Valued } from './account';

export type Contribution = { sym: string; amount: number; pct: number | null };
export type Analysis = {
  day: number;
  dayPct: number | null;
  movers: Contribution[]; // today's, biggest effect first (up to 4)
  lead: Contribution | null; // adding the most today
  drag: Contribution | null; // taking the most today
  bestOpen: { name: string; amount: number; pct: number } | null;
  worstOpen: { name: string; amount: number; pct: number } | null;
};

export function analyze(v: Valued): Analysis | null {
  const holdings = v.rows.length + v.optionRows.length;
  if (!holdings) return null;
  const today = v.rows
    .filter((r) => r.dayChange != null && Math.abs(r.dayChange) >= 0.005)
    .map((r) => ({ sym: r.sym, amount: r.dayChange!, pct: r.value - r.dayChange! > 0 ? (r.dayChange! / (r.value - r.dayChange!)) * 100 : null }));
  const movers = [...today].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 4);
  const up = today.filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount)[0] ?? null;
  const down = today.filter((x) => x.amount < 0).sort((a, b) => a.amount - b.amount)[0] ?? null;
  const open = [
    ...v.rows.map((r) => ({ name: r.sym, amount: r.pnl, pct: r.pnlPct })),
    ...v.optionRows.filter((r) => !r.expired).map((r) => ({ name: r.label, amount: r.pnl, pct: r.pnlPct })),
  ].filter((x) => Math.abs(x.amount) >= 0.005);
  const best = open.filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount)[0] ?? null;
  const worst = open.filter((x) => x.amount < 0).sort((a, b) => a.amount - b.amount)[0] ?? null;
  const start = v.equity - v.dayPnl;
  return { day: v.dayPnl, dayPct: start > 0 ? (v.dayPnl / start) * 100 : null, movers, lead: up, drag: down, bestOpen: best, worstOpen: worst };
}

/**
 * Your top gainers and losers (owner 2026-11-15, clarified: "your option call is up $40"): every
 * open stock and option position ranked by its open P&L, what it's up or down since you opened
 * it. Today's move is kept for the detail: a stock, shares × (price − previous close, or your
 * cost if bought today); an option, its model price now minus its model price at the stock's
 * previous close (the model the account is valued with), × 100 × contracts.
 */
export type Contributor = { key: string; kind: 'stock' | 'option'; name: string; sym: string; pnl: number; pnlPct: number; today: number | null; todayPct: number | null; last: number | null; to: string };

export function contributors(v: Valued, quotes: Record<string, Quote>, vols: Vols | null, today: string): { gainers: Contributor[]; losers: Contributor[] } {
  const all: Contributor[] = [];
  for (const r of v.rows) {
    const start = r.dayChange != null ? r.value - r.dayChange : 0;
    all.push({ key: r.sym, kind: 'stock', name: r.sym, sym: r.sym, pnl: r.pnl, pnlPct: r.pnlPct, today: r.dayChange, todayPct: r.dayChange != null && start > 0 ? (r.dayChange / start) * 100 : null, last: r.last, to: `/practice/trade/${r.sym}` });
  }
  for (const o of v.optionRows) {
    if (o.expired) continue;
    const q = quotes[o.u];
    const before = q?.c && q.pc ? markValue(o, q.pc, volFor(vols, o.u), today) : null;
    all.push({
      key: o.id, kind: 'option', name: o.label, sym: o.u, pnl: o.pnl, pnlPct: o.pnlPct,
      today: before != null ? (o.mark - before) * 100 * o.qty : null, todayPct: before ? (o.mark / before - 1) * 100 : null,
      last: o.mark, to: `/options/${o.u}?pos=${encodeURIComponent(o.id)}`,
    });
  }
  const open = all.filter((c) => Math.abs(c.pnl) >= 0.005);
  return {
    gainers: open.filter((c) => c.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 3),
    losers: open.filter((c) => c.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 3),
  };
}
