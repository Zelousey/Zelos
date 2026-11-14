/**
 * Why your account moved (owner 2026-11-14, like a broker's "what's moving your portfolio"):
 * today's change by stock (from the previous close, or your cost if bought today), the biggest
 * contributor and the biggest drag, and your biggest open gain and loss overall (stocks and options).
 * Pure: it only reads the valued account.
 */
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
