/** Everything a chart of one symbol needs for a timeframe: quote, bars, loading/error, retry. */
import { useMemo } from 'react';
import { useIntraday, useQuotes } from '../../data/markets';
import { useHistory } from '../../data/useHistory';
import { barsFor, type Timeframe } from './series';

export function useSymbolBars(sym: string, tf: Timeframe) {
  const quotes = useQuotes();
  const daily = tf === 'D' || tf === 'W';
  const history = useHistory(daily);
  const intraday = useIntraday(daily ? null : sym);
  const quote = quotes.status === 'ready' ? quotes.data.quotes[sym] : undefined;
  const built = useMemo(() => barsFor(tf, { history: history.data[sym], intraday: intraday.status === 'ready' ? intraday.data : [], quote }), [tf, history.data, sym, intraday, quote]);
  return {
    quotes,
    quote,
    built,
    loading: daily ? history.status === 'loading' : intraday.status === 'loading',
    failed: daily ? history.status === 'error' : intraday.status === 'error',
    retry: history.retry,
  };
}
