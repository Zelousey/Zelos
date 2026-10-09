/**
 * Your option contracts (on Options and on Practice): value at the model price, P&L, and
 * Sell to close at the model bid on the next price update. Expired ones wait for the close.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { formatDate, formatMoney, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, Change, Confirm, EmptyState, useToast } from '../../ui';
import { sellableContracts, type Account, type Valued } from '../practice/account';
import { errorMessage } from '../practice/actions';
import { placeOptionOrder } from './actions';
import s from './Options.module.css';

type Row = Valued['optionRows'][number];

export function OptionPositions({ acct, rows, empty }: { acct: Account; rows: Row[]; empty?: boolean }) {
  const toast = useToast();
  const [selling, setSelling] = useState<{ row: Row; qty: number } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!rows.length) return empty ? <EmptyState icon="options" body={t('opt.positions.empty')} compact /> : null;
  return (
    <>
      <ul className={s.positions}>
        {rows.map((r) => {
          const free = sellableContracts(acct, r.id);
          return (
            <li key={r.id} className={s.position}>
              <span>
                <Link to={`/options/${r.u}`} className={s.posLabel}>
                  {r.label}
                </Link>
                <span className={s.sub}>
                  {t('opt.held', { qty: r.qty, avg: formatPrice(r.avg) })} · {r.expired ? t('opt.expiredNote') : t('opt.expires', { date: formatDate(r.exp + 'T12:00:00Z') })}
                </span>
              </span>
              <span className={s.right}>
                <span className="num">{formatMoney(r.value)}</span>
                <Change abs={r.pnl} pct={r.pnlPct} />
              </span>
              <span className={s.posActions}>
                {r.expired ? (
                  <Badge>{t('opt.settling')}</Badge>
                ) : (
                  <Button variant="secondary" size="sm" disabled={busy || free === 0} onClick={() => setSelling({ row: r, qty: free })} aria-label={`${t('opt.sell')}: ${r.label}`}>
                    {t('opt.sell')}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <Confirm
        open={!!selling}
        title={t('opt.sell')}
        action={t('trade.sell')}
        variant="sell"
        busy={busy}
        onClose={() => setSelling(null)}
        onConfirm={() => {
          const x = selling!;
          setBusy(true);
          placeOptionOrder({ u: x.row.u, type: x.row.kind, strike: x.row.strike, exp: x.row.exp, side: 'sell', qty: x.qty })
            .then(() => {
              toast.show(t('opt.placed'), 'success');
              setSelling(null);
            })
            .catch((e) => toast.show(errorMessage(e), 'error'))
            .finally(() => setBusy(false));
        }}
      >
        {selling && t('opt.sellConfirm', { qty: selling.qty, label: selling.row.label })}
      </Confirm>
    </>
  );
}
