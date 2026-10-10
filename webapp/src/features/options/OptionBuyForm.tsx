/**
 * Buying one option contract: price, breakeven, days left, how many contracts, the total and
 * the estimated P&L chart, then Buy. Used by the Options page's buy sheet and by the trade
 * ticket's Options choice. The server re-prices and fills it on the next price update.
 */
import { useState } from 'react';
import { formatMoney, formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Button, Field, useToast } from '../../ui';
import { errorMessage } from '../practice/actions';
import { placeOptionOrder } from './actions';
import { label, MAX_CONTRACTS, type Kind, type OptionQuote } from './model';
import { breakeven } from './pnl';
import { PnlEstimator } from './PnlEstimator';
import s from './Options.module.css';

type Props = { sym: string; kind: Kind; exp: string; strike: number; q: OptionQuote; S: number; vol: number; today: string; canTrade: boolean; buyingPower: number | null; onDone?: () => void; onCancel?: () => void };

export function OptionBuyForm({ sym, kind, exp, strike, q, S, vol, today, canTrade, buyingPower, onDone, onCancel }: Props) {
  const toast = useToast();
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const n = Number(qty);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_CONTRACTS;
  const cost = valid ? q.ask * 100 * n : 0;
  const short = valid && buyingPower != null && cost > buyingPower + 0.005;
  const err = qty && !valid ? t('opt.qtyRange', { max: MAX_CONTRACTS }) : short ? t('opt.short', { bp: formatMoney(buyingPower) }) : undefined;
  const leg = { kind, strike, exp };
  return (
    <div className={s.sheet}>
      <dl className={s.facts}>
        <div>
          <dt>{t('opt.perShare')}</dt>
          <dd className="num">{formatPrice(q.ask)}</dd>
        </div>
        <div>
          <dt>{t('opt.col.breakeven')}</dt>
          <dd className="num">{formatPrice(breakeven(leg, q.ask))}</dd>
        </div>
        <div>
          <dt>{t('opt.daysLeft')}</dt>
          <dd className="num">{q.dte}</dd>
        </div>
      </dl>
      <Field label={t('opt.contracts')} type="number" inputMode="numeric" min={1} max={MAX_CONTRACTS} step={1} value={qty} onChange={(e) => setQty(e.target.value)} hint={t('opt.each')} error={err} />
      <p className={s.total}>
        {t('opt.total')} <b className="num">{formatMoney(cost)}</b>
        {buyingPower != null && <span className={s.sub}>{t('opt.bp', { bp: formatMoney(buyingPower) })}</span>}
      </p>
      <p className={s.sub}>{t('opt.risk', { cost: formatMoney(cost) })}</p>
      <PnlEstimator key={`${kind}${strike}${exp}`} sym={sym} leg={leg} paid={q.ask} qty={valid ? n : 1} S={S} vol={vol} today={today} />
      <div className={s.sheetActions}>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
        <Button
          variant="buy"
          disabled={!canTrade || !valid || short || busy}
          aria-label={`${t('opt.buyN', { n: valid ? n : 0 })} · ${label({ u: sym, kind, strike, exp })}`}
          onClick={() => {
            setBusy(true);
            placeOptionOrder({ u: sym, type: kind, strike, exp, side: 'buy', qty: n })
              .then(() => {
                toast.show(t('opt.placed'), 'success');
                onDone?.();
              })
              .catch((e) => toast.show(errorMessage(e), 'error'))
              .finally(() => setBusy(false));
          }}
        >
          {t('opt.buyN', { n: valid ? n : 0 })}
        </Button>
      </div>
    </div>
  );
}
