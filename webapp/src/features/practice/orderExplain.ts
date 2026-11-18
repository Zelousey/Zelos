/**
 * What a pending order is waiting for, in plain words (owner 2026-11-18: a HOOD limit and stop sat
 * "pending" for days and it wasn't clear why). A limit or stop order waits, good till cancelled,
 * until the price reaches its level; the two sides of a bracket wait together and the first to fill
 * cancels the other.
 */
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { Order } from './account';

export function explainOrder(o: Order, last: number | null | undefined, marketOpen: boolean): string {
  const now = last ? t('ox.now', { price: formatPrice(last) }) : '';
  let text: string;
  if (o.opt || o.type === 'market') text = t('ox.market');
  else if (o.type === 'limit' && o.limit != null) text = t(o.side === 'sell' ? 'ox.sellLimit' : 'ox.buyLimit', { sym: o.sym, price: formatPrice(o.limit), now });
  else if (o.type === 'stop' && o.stop != null) text = t(o.side === 'sell' ? 'ox.sellStop' : 'ox.buyStop', { sym: o.sym, price: formatPrice(o.stop), now });
  else text = t('ox.market');
  if (o.role === 'tp' || o.role === 'sl') text += ' ' + t(o.role === 'tp' ? 'ox.tpSide' : 'ox.slSide');
  if (o.type !== 'market' && !o.opt) text += ' ' + t(o.tif === 'gtc' ? 'ox.gtc' : 'ox.day');
  if (!marketOpen) text = t('ox.closed') + ' ' + text;
  return text;
}
