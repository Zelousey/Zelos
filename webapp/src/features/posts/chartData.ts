/**
 * The price line around a trade, for the share card (the same as functions/posts.py trade_chart,
 * which builds the posted copy). A few bars before the buy to a few after the sale, closes only,
 * thinned to about 90 points with the buy and the sale kept exactly.
 */
import type { Bar } from '../../data/markets';

export type CardChart = { t: (string | number)[]; p: number[]; buy?: number; sell?: number };
export const CHART_POINTS = 90;

export function thin(n: number, keep: number[], max = CHART_POINTS): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (max - 1);
  const s = new Set<number>();
  for (let i = 0; i < max; i++) s.add(Math.round(i * step));
  keep.forEach((k) => k >= 0 && k < n && s.add(k));
  return [...s].sort((a, b) => a - b);
}

export function tradeChart(bars: Bar[], buyLabel: string, sellLabel: string, pad = 3): CardChart | null {
  const rows = bars.filter((b) => b[4] > 0).map((b) => [b[0], b[4]] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (rows.length < 2) return null;
  const bi = rows.findIndex((b) => b[0] >= buyLabel);
  let si = -1;
  rows.forEach((b, i) => {
    if (b[0] <= sellLabel) si = i;
  });
  if (bi < 0 || si < 0 || si < bi) return null;
  const lo = Math.max(0, bi - pad);
  const hi = Math.min(rows.length - 1, si + pad);
  const win = rows.slice(lo, hi + 1);
  const keep = thin(win.length, [bi - lo, si - lo]);
  return { t: keep.map((i) => win[i]![0]), p: keep.map((i) => win[i]![1]), buy: keep.indexOf(bi - lo), sell: keep.indexOf(si - lo) };
}

export function curveChart(curve: { t: number; v: number }[]): CardChart | null {
  if (curve.length < 2) return null;
  const keep = thin(curve.length, [0, curve.length - 1]);
  return { t: keep.map((i) => curve[i]!.t), p: keep.map((i) => curve[i]!.v) };
}

/** "YYYY-MM-DD HH:MM" in New York for a time in ms (how the minute prices are labelled). */
export function nyLabel(ms: number): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
