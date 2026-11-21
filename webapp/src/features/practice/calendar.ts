/**
 * The profit calendar (owner 2026-11-19: "a calendar for the month, and each day it will show how
 * much you made that day, and you can click on it and see your trades"). Pure functions, tested in
 * calendar.test.ts.
 *
 * A day's result is the change in your account value from the day before (the server keeps each
 * day's closing value for 90 days, practiceAccounts.hist), so it counts open positions too, not
 * only closed trades. Today uses the live day change. A day you reset the account is marked, not
 * counted (its value jumps back to $10,000).
 */
import type { DayValue, HistoryItem } from './account';

export type DayCell = { day: string; inMonth: boolean; weekend: boolean; pnl: number | null; reset: boolean; trades: number; today: boolean };
export type MonthSummary = { total: number; green: number; red: number; best: DayCell | null; worst: DayCell | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** {day: change} from consecutive closing values; a reset day has no change. */
export function dayChanges(hist: DayValue[], resetDays: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const resets = new Set(resetDays);
  for (let i = 1; i < hist.length; i++) {
    const d = hist[i]!.day;
    if (resets.has(d)) continue;
    out[d] = Math.round((hist[i]!.e - hist[i - 1]!.e) * 100) / 100;
  }
  return out;
}

/** The weeks (Sunday to Saturday) covering a month; month is 1-12. */
export function monthGrid(year: number, month: number, changes: Record<string, number>, resetDays: string[], trades: HistoryItem[], today: string, todayPnl: number | null): DayCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const d = new Date(first);
  d.setUTCDate(1 - first.getUTCDay());
  const counts: Record<string, number> = {};
  for (const t of trades) if (t.kind === 'trade' && t.closeDay) counts[t.closeDay] = (counts[t.closeDay] ?? 0) + 1;
  const resets = new Set(resetDays);
  const weeks: DayCell[][] = [];
  do {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const day = iso(d);
      const wd = d.getUTCDay();
      const live = day === today && todayPnl != null && changes[day] == null ? todayPnl : null;
      week.push({ day, inMonth: d.getUTCMonth() === month - 1, weekend: wd === 0 || wd === 6, pnl: changes[day] ?? live, reset: resets.has(day), trades: counts[day] ?? 0, today: day === today });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (d.getUTCMonth() === month - 1);
  return weeks;
}

export function summarize(weeks: DayCell[][]): MonthSummary {
  const days = weeks.flat().filter((c) => c.inMonth && c.pnl != null);
  const s: MonthSummary = { total: 0, green: 0, red: 0, best: null, worst: null };
  for (const c of days) {
    s.total += c.pnl!;
    if (c.pnl! > 0) s.green++;
    if (c.pnl! < 0) s.red++;
    if (!s.best || c.pnl! > s.best.pnl!) s.best = c;
    if (!s.worst || c.pnl! < s.worst.pnl!) s.worst = c;
  }
  s.total = Math.round(s.total * 100) / 100;
  return s;
}

/** The trades closed and the fills on one day. */
export function dayActivity(items: HistoryItem[], day: string, nyDay: (ms: number) => string) {
  return {
    trades: items.filter((t) => t.kind === 'trade' && t.closeDay === day),
    fills: items.filter((t) => t.kind === 'fill' && nyDay(t.at) === day),
  };
}

/** "+$600", "−$1.2K": short amounts for a calendar square. */
export function shortMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}K`;
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}K`;
  return `${sign}$${Math.round(a)}`;
}
