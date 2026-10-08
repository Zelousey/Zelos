/** One instrument in a list: symbol + name, price, today's change. Taps through to its chart. */
import { Link } from 'react-router';
import { formatPrice } from '../../lib/format';
import { Change } from '../../ui';
import s from './MarketRow.module.css';

export type MarketRowData = { sym: string; name: string; price: number | null | undefined; chPct: number | null | undefined };

export function MarketList({ rows, label, replace }: { rows: MarketRowData[]; label: string; replace?: boolean }) {
  return (
    <ul className={s.list} aria-label={label}>
      {rows.map((r) => (
        <li key={r.sym}>
          <Link to={`/markets/${encodeURIComponent(r.sym)}`} replace={replace} className={s.row}>
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
