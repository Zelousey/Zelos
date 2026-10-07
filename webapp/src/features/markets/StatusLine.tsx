import type { Loadable } from '../../data/liveDoc';
import type { QuotesDoc } from '../../data/markets';
import { marketStatus } from '../../data/marketStatus';
import s from './MarketsPage.module.css';

/** "Market open · updated 3 min ago · Marketstack" with a green/grey dot (text says it too). */
export function StatusLine({ quotes }: { quotes: Loadable<QuotesDoc> }) {
  const st = marketStatus(quotes.status === 'ready' ? quotes.data : null);
  return (
    <p className={[s.status, st.open && s.open].filter(Boolean).join(' ')} role="status">
      <span className={s.dot} aria-hidden />
      {st.text}
    </p>
  );
}
