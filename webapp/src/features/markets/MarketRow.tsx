/** One instrument in a list: symbol + name, price, today's change. Taps through to its chart. */
import { Link } from 'react-router';
import { formatPrice } from '../../lib/format';
import { Change } from '../../ui';
import s from './MarketRow.module.css';

export type MarketRowData = { sym: string; name: string; price: number | null | undefined; chPct: number | null | undefined };

/** onPick: tapping a row hands its symbol back (Find a stock) instead of opening the chart. */
export function MarketList({ rows, label, replace, onPick }: { rows: MarketRowData[]; label: string; replace?: boolean; onPick?: (sym: string) => void }) {
  return (
    <ul className={s.list} aria-label={label}>
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
            <span className={s.price}>{formatPrice(r.price)}</span>
            <Change pct={r.chPct} className={s.chg} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
