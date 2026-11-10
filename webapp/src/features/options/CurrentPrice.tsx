/** The underlying stock's current price on the options screens (owner 2026-11-10: bold and high
 * contrast, so it's the first thing you see). */
import { useQuotes } from '../../data/markets';
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Change } from '../../ui';
import s from './Options.module.css';

export function CurrentPrice({ sym, price }: { sym: string; price: number | null | undefined }) {
  const quotes = useQuotes();
  const q = quotes.status === 'ready' ? quotes.data.quotes[sym] : undefined;
  const pct = q?.chPct ?? (q?.pc && q.c ? (q.c / q.pc - 1) * 100 : null);
  return (
    <div className={s.nowPrice} role="group" aria-label={t('opt.nowPrice', { sym })}>
      <span className={s.nowLabel}>{t('opt.nowPrice', { sym })}</span>
      <span className={s.nowValue}>{formatPrice(price ?? q?.c)}</span>
      {pct != null && <Change pct={pct} />}
    </div>
  );
}
