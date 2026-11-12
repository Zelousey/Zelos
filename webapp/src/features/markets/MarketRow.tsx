/** One instrument in a list: symbol + name, price, today's change. Taps through to its chart. */
import { Link } from 'react-router';
import { formatPrice } from '../../lib/format';
import { Change, Ticker } from '../../ui';
import s from './MarketRow.module.css';

export type MarketRowData = { sym: string; name: string; price: number | null | undefined; chPct: number | null | undefined };

/** onPick: tapping a row hands its symbol back (Find a stock) instead of opening the chart.
 * dense: one line per stock (symbol, price, change), for side panels and multi-column lists. */
export function MarketList({ rows, label, replace, onPick, dense, columns }: { rows: MarketRowData[]; label: string; replace?: boolean; onPick?: (sym: string) => void; dense?: boolean; columns?: boolean }) {
  return (
    <ul className={[s.list, dense && s.dense, columns && s.columns].filter(Boolean).join(' ')} aria-label={label}>
      {rows.map((r) => (
        <li key={r.sym}>
          <Link
            to={`/markets/${encodeURIComponent(r.sym)}`}
            replace={replace}
            className={s.row}
            aria-haspopup={onPick ? 'dialog' : undefined}
            onClick={
              onPick &&
              ((e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // a new tab still opens the chart
                e.preventDefault();
                onPick(r.sym);
              })
            }
          >
            <span className={s.id}>
              <span className={s.sym}>{r.sym}</span>
              <span className={s.name}>{r.name}</span>
            </span>
            <Ticker value={r.price} className={s.price}>
              {formatPrice(r.price)}
            </Ticker>
            <Change pct={r.chPct} className={s.chg} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
