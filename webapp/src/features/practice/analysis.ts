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
 * Your top gainers and losers today (owner 2026-11-15): what each holding added to or took from
 * the account today, stocks and options together. A stock: shares × (price − previous close, or
 * your cost if bought today). An option: its model price now minus its model price at the
 * stock's previous close (the same model the account is valued with), × 100 × contracts.
 */
export type Contributor = { key: string; kind: 'stock' | 'option'; name: string; sym: string; amount: number; pct: number | null; last: number | null; pnl: number; pnlPct: number; to: string };

export function contributors(v: Valued, quotes: Record<string, Quote>, vols: Vols | null, today: string): { gainers: Contributor[]; losers: Contributor[] } {
  const all: Contributor[] = [];
  for (const r of v.rows) {
    if (r.dayChange == null || Math.abs(r.dayChange) < 0.005) continue;
    const start = r.value - r.dayChange;
    all.push({ key: r.sym, kind: 'stock', name: r.sym, sym: r.sym, amount: r.dayChange, pct: start > 0 ? (r.dayChange / start) * 100 : null, last: r.last, pnl: r.pnl, pnlPct: r.pnlPct, to: `/practice/trade/${r.sym}` });
  }
  for (const o of v.optionRows) {
    const q = quotes[o.u];
    if (o.expired || !q?.c || !q.pc) continue;
    const before = markValue(o, q.pc, volFor(vols, o.u), today);
    const amount = (o.mark - before) * 100 * o.qty;
    if (Math.abs(amount) < 0.005) continue;
    all.push({ key: o.id, kind: 'option', name: o.label, sym: o.u, amount, pct: before > 0 ? (o.mark / before - 1) * 100 : null, last: o.mark, pnl: o.pnl, pnlPct: o.pnlPct, to: `/options/${o.u}?pos=${encodeURIComponent(o.id)}` });
  }
  return {
    gainers: all.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3),
    losers: all.filter((c) => c.amount < 0).sort((a, b) => a.amount - b.amount).slice(0, 3),
  };
}
