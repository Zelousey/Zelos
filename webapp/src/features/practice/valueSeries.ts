/**
 * The account value chart's data (owner 2026-10-10: "the account value chart, and it reacts to
 * live prices"). Longer ranges use the server's daily closing values (`hist`, 90 days) plus
 * today's live value. Today (1D) is rebuilt minute by minute from the 1-minute prices of what
 * you held at each minute: today's buys and sells are replayed backwards from what you hold now
 * (owner 2026-11-12: "like Robinhood ... say you go up to 11,000 and back down to 10, it still
 * shows it going up and back down", also after you sell). Its last point is always the live value.
 */
import type { Bar, Quote } from '../../data/markets';
import { closeMs, markValue, parseContract, volFor, type Vols } from '../options/model';
import type { Account, DayValue } from './account';

export type ValuePoint = { t: number; v: number; label: string };
/** One of today's fills: minute after midnight (New York), the stock (or option contract id), side, size and price. */
export type DayFill = { m: number; sym: string; opt?: string; side: 'buy' | 'sell'; qty: number; price: number };

/** Minutes after midnight in New York for a time in ms. */
export function nyMinute(ms: number): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
  return +(p.find((x) => x.type === 'hour')?.value ?? 0) * 60 + +(p.find((x) => x.type === 'minute')?.value ?? 0);
}

type Holdings = { cash: number; shares: Map<string, { qty: number; avg: number }>; options: Map<string, { qty: number; avg: number }> };

/** What you held just after minute m: now, with every fill after m undone. */
export function holdingsAt(a: Account, fills: DayFill[], m: number): Holdings {
  const shares = new Map(a.positions.map((p) => [p.sym, { qty: p.qty, avg: p.avg }]));
  const options = new Map(a.options.map((o) => [o.id, { qty: o.qty, avg: o.avg }]));
  let cash = a.cash;
  for (const f of fills) {
    if (f.m <= m) continue;
    const mult = f.opt ? 100 : 1;
    const book = f.opt ? options : shares;
    const key = f.opt ?? f.sym;
    const cur = book.get(key) ?? { qty: 0, avg: f.price };
    if (f.side === 'buy') {
      cash += f.qty * f.price * mult;
      cur.qty -= f.qty;
    } else {
      cash -= f.qty * f.price * mult;
      cur.qty += f.qty;
      if (!book.has(key)) cur.avg = f.price;
    }
    book.set(key, cur);
  }
  return { cash, shares, options };
}
export type Range = '1D' | '1W' | '1M' | '3M';

const DAY_SPAN: Record<Exclude<Range, '1D'>, number> = { '1W': 7, '1M': 31, '3M': 92 };

/** Minutes after midnight for "YYYY-MM-DD HH:MM" (New York time, as the price docs store it). */
export const minuteOf = (label: string) => +label.slice(11, 13) * 60 + +label.slice(14, 16);
export const OPEN_MIN = 9 * 60 + 30;
export const CLOSE_MIN = 16 * 60;

export const dayNum = (day: string) => Date.parse(day + 'T12:00:00Z') / 864e5;

/** The trading day 1D shows: the newest day with 1-minute prices (Friday on a weekend), at most today. */
export function sessionDay(bars: Record<string, Bar[]>, today: string): string {
  let best = '';
  for (const list of Object.values(bars)) {
    const d = list[list.length - 1]?.[0].slice(0, 10) ?? '';
    if (d > best && d <= today) best = d;
  }
  return best || today;
}

/** Yesterday's (or the last earlier) closing value: the 1D baseline. */
export function previousClose(hist: DayValue[], today: string, fallback: number): number {
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i]!.day < today) return hist[i]!.e;
  return fallback;
}

/** Daily points for 1W / 1M / 3M: saved closes in the window, then today's live value. */
export function dailyPoints(hist: DayValue[], today: string, live: number, range: Exclude<Range, '1D'>): ValuePoint[] {
  const from = dayNum(today) - DAY_SPAN[range];
  const pts = hist.filter((h) => h.day < today && dayNum(h.day) >= from).map((h) => ({ t: dayNum(h.day), v: h.e, label: h.day }));
  pts.push({ t: dayNum(today), v: live, label: today });
  return pts;
}

/**
 * Today's value minute by minute with your current holdings: cash + shares × that minute's
 * price + option contracts at the model price. `t` is minutes after midnight (New York).
 */
export function intradayPoints(a: Account, bars: Record<string, Bar[]>, quotes: Record<string, Quote>, session: string, today: string, vols: Vols | null, live: number, nowMin: number, fills: DayFill[] = []): ValuePoint[] {
  const syms = [...new Set([...a.positions.map((p) => p.sym), ...a.options.map((o) => o.u), ...fills.map((f) => f.sym)])];
  const todays: Record<string, Bar[]> = {};
  const minutes = new Set<number>();
  for (const sym of syms) {
    const list = (bars[sym] ?? []).filter((b) => b[0].startsWith(session) && b[0].length >= 16);
    todays[sym] = list;
    for (const b of list) minutes.add(minuteOf(b[0]));
  }
  const grid = [...minutes].filter((m) => m >= OPEN_MIN && m <= CLOSE_MIN).sort((x, y) => x - y);
  const idx: Record<string, number> = {};
  const out: ValuePoint[] = [];
  for (const m of grid) {
    const price = (sym: string) => {
      const list = todays[sym]!;
      let i = idx[sym] ?? -1;
      while (i + 1 < list.length && minuteOf(list[i + 1]![0]) <= m) i++;
      idx[sym] = i;
      // before a stock's first trade today: yesterday's close, else the price now
      return i >= 0 ? list[i]![4] : (quotes[sym]?.pc ?? quotes[sym]?.c);
    };
    const h = holdingsAt(a, fills, m);
    let v = h.cash;
    for (const [sym, p] of h.shares) if (p.qty > 0) v += p.qty * (price(sym) ?? p.avg);
    for (const [id, o] of h.options) {
      const c = o.qty > 0 ? parseContract(id) : null;
      // priced at that minute (a contract expiring that day loses time value through the day; with
      // the clock's "now" every past minute would be valued as if it had already expired)
      if (c) v += o.qty * 100 * markValue({ ...c, avg: o.avg }, price(c.u), volFor(vols, c.u), session, closeMs(session) - (CLOSE_MIN - m) * 60_000);
    }
    out.push({ t: m, v, label: `${session} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` });
  }
  // the newest point is always the live value shown above the chart
  const t = session === today ? Math.min(CLOSE_MIN, Math.max(OPEN_MIN, nowMin)) : CLOSE_MIN;
  if (!out.length || out[out.length - 1]!.t < t) out.push({ t, v: live, label: 'now' });
  else out[out.length - 1] = { ...out[out.length - 1]!, v: live };
  return out;
}

/** Change over the range: from the baseline to the last point. */
export function change(points: ValuePoint[], base: number): { abs: number; pct: number } {
  const last = points[points.length - 1]?.v ?? base;
  return { abs: last - base, pct: base ? ((last - base) / base) * 100 : 0 };
}
