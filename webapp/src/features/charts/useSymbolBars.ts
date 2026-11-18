/** Everything a chart of one symbol needs for a timeframe: quote, bars, loading/error, retry. */
import { useMemo } from 'react';
import { useIntraday, useIntradayHistory, useQuotes } from '../../data/markets';
import { useHistory } from '../../data/useHistory';
import { barsFor, joinIntraday, type Timeframe } from './series';

export function useSymbolBars(sym: string, tf: Timeframe) {
  const quotes = useQuotes();
  const daily = tf === 'D' || tf === 'W';
  const history = useHistory(daily);
  const intraday = useIntraday(daily ? null : sym);
  // the 5-minute chart shows at most 5 days, so only 15m and 1H read the longer history
  const older = useIntradayHistory(daily || tf === '5m' ? null : sym);
  const quote = quotes.status === 'ready' ? quotes.data.quotes[sym] : undefined;
  const built = useMemo(() => {
    const live = intraday.status === 'ready' ? intraday.data : [];
    return barsFor(tf, { history: history.data[sym], intraday: joinIntraday(older.status === 'ready' ? older.data : [], live), quote });
  }, [tf, history.data, sym, intraday, older, quote]);
  return {
    quotes,
    quote,
    built,
    loading: daily ? history.status === 'loading' : intraday.status === 'loading',
    failed: daily ? history.status === 'error' : intraday.status === 'error',
    retry: history.retry,
  };
}
