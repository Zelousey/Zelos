/**
 * Turning stored bars into what a chart shows, per timeframe. Pure functions (unit-tested),
 * ported from the classic practice page so both draw the same bars.
 *
 *   15m / 1H  from markets/intraday_SYM (1-minute or 15-minute bars, last 5 sessions), grouped
 *             into 15-minute or hourly buckets anchored at 9:30 ET
 *   D         from ~2 years of daily history; the live quote updates (or adds) today's bar
 *   W         daily bars grouped by week (Monday)
 */
import type { Bar, Quote } from '../../data/markets';

export type Timeframe = '15m' | '1h' | 'D' | 'W';

export const TIMEFRAMES: { id: Timeframe; label: string; ranges: [string, number | 'all'][]; def: number | 'all' }[] = [
  { id: '15m', label: '15m', ranges: [['1D', 26], ['2D', 52], ['5D', 130]], def: 26 },
  { id: '1h', label: '1H', ranges: [['1D', 7], ['5D', 35]], def: 35 },
  { id: 'D', label: 'D', ranges: [['1M', 21], ['3M', 63], ['6M', 126], ['1Y', 252], ['All', 'all']], def: 126 },
  { id: 'W', label: 'W', ranges: [['6M', 26], ['1Y', 52], ['All', 'all']], def: 52 },
];

const SESSION_OPEN_MIN = 9 * 60 + 30;

export function nyDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ms));
}

/** Daily bars with today's live quote applied (updates today's bar, or adds it). */
export function dailyBars(history: Bar[], q: Quote | undefined): { bars: Bar[]; live: boolean } {
  const bars = history.map((b) => [...b] as Bar);
  if (!q || !q.c || !bars.length) return { bars, live: false };
  const qd = q.t ? nyDay(q.t * 1000) : null;
  const last = bars[bars.length - 1]!;
  if (qd && qd > last[0] && q.o) {
    bars.push([qd, q.o, Math.max(q.h, q.c), Math.min(q.l, q.c), q.c, q.v || 0]);
    return { bars, live: true };
  }
  if (qd === last[0]) {
    last[4] = q.c;
    last[2] = Math.max(last[2], q.c);
    last[3] = Math.min(last[3], q.c);
    return { bars, live: true };
  }
  return { bars, live: false };
}

/** Monday (YYYY-MM-DD) of the week a date falls in. */
export function weekKey(day: string): string {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function weeklyBars(daily: Bar[]): Bar[] {
  const out: Bar[] = [];
  let cur: Bar | null = null;
  for (const b of daily) {
    const k = weekKey(b[0].slice(0, 10));
    if (!cur || cur[0] !== k) {
      cur = [k, b[1], b[2], b[3], b[4], b[5]];
      out.push(cur);
    } else {
      cur[2] = Math.max(cur[2], b[2]);
      cur[3] = Math.min(cur[3], b[3]);
      cur[4] = b[4];
      cur[5] += b[5];
    }
  }
  return out;
}

/** Group intraday bars into `step`-minute buckets from the 9:30 ET open; the live quote moves today's last bar. */
export function intradayBars(base: Bar[], step: number, q: Quote | undefined): Bar[] {
  const out: Bar[] = [];
  let cb: Bar | null = null;
  for (const r of base) {
    const mins = parseInt(r[0].slice(11, 13), 10) * 60 + parseInt(r[0].slice(14, 16), 10);
    if (!Number.isFinite(mins)) continue;
    const b = SESSION_OPEN_MIN + Math.floor((mins - SESSION_OPEN_MIN) / step) * step;
    const label = `${r[0].slice(0, 11)}${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`;
    if (!cb || cb[0] !== label) {
      cb = [label, r[1], r[2], r[3], r[4], r[5]];
      out.push(cb);
    } else {
      cb[2] = Math.max(cb[2], r[2]);
      cb[3] = Math.min(cb[3], r[3]);
      cb[4] = r[4];
      cb[5] += r[5];
    }
  }
  const lb = out[out.length - 1];
  if (q && q.c && q.t && lb && lb[0].slice(0, 10) === nyDay(q.t * 1000)) {
    lb[4] = q.c;
    lb[2] = Math.max(lb[2], q.c);
    lb[3] = Math.min(lb[3], q.c);
  }
  return out;
}

export function barsFor(tf: Timeframe, inputs: { history?: Bar[]; intraday?: Bar[]; quote?: Quote }): { bars: Bar[]; live: boolean; intraday: boolean } {
  if (tf === 'D' || tf === 'W') {
    const d = dailyBars(inputs.history ?? [], inputs.quote);
    return { bars: tf === 'W' ? weeklyBars(d.bars) : d.bars, live: d.live, intraday: false };
  }
  return { bars: intradayBars(inputs.intraday ?? [], tf === '1h' ? 60 : 15, inputs.quote), live: false, intraday: true };
}
