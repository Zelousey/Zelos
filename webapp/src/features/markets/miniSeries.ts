/**
 * Mini-chart data: the last month of daily closes for a symbol, with today's live quote as
 * the newest point (same rule as the daily chart, see series.dailyBars). From the daily
 * history that is loaded once per session, so mini charts cost no extra reads.
 */
import { useMemo } from 'react';
import type { Bar, Quote } from '../../data/markets';
import { useQuotes } from '../../data/markets';
import { useHistory } from '../../data/useHistory';
import { dailyBars } from '../charts/series';

export type Mini = { closes: number[]; price: number | null; chPct: number | null; periodPct: number | null };

export const MINI_DAYS = 22; // about one month of sessions

export function miniFor(history: Bar[] | undefined, q: Quote | undefined): Mini {
  const { bars } = dailyBars(history ?? [], q);
  const closes = bars.slice(-MINI_DAYS).map((b) => b[4]).filter((c) => c > 0);
  const first = closes[0];
  const last = closes[closes.length - 1];
  return {
    closes,
    price: q?.c ?? last ?? null,
    chPct: q?.chPct ?? null,
    periodPct: first && last && closes.length > 1 ? (last / first - 1) * 100 : null,
  };
}

export function useMinis(): { status: 'loading' | 'ready' | 'error'; get: (sym: string) => Mini } {
  const history = useHistory(true);
  const quotes = useQuotes();
  const qs = quotes.status === 'ready' ? quotes.data.quotes : null;
  return useMemo(() => {
    const cache = new Map<string, Mini>();
    return {
      status: history.status,
      get: (sym: string) => {
        let m = cache.get(sym);
        if (!m) {
          m = miniFor(history.data[sym], qs?.[sym]);
          cache.set(sym, m);
        }
        return m;
      },
    };
  }, [history.status, history.data, qs]);
}
