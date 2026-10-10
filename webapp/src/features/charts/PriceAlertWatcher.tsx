/**
 * Fires your price alerts while the app is open: on every live quote update, alerts whose
 * price was crossed show a message once (the engine's store marks them triggered). Mounted
 * once in the app shell.
 */
import { useEffect } from 'react';
import { useQuotes } from '../../data/markets';
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useToast } from '../../ui';
import { engine } from './engine';

export function PriceAlertWatcher() {
  const q = useQuotes();
  const toast = useToast();
  useEffect(() => {
    if (q.status !== 'ready') return;
    const prices = Object.fromEntries(Object.entries(q.data.quotes).map(([k, v]) => [k, v.c]));
    const hit = engine().alerts.check(prices);
    hit.forEach((a) => toast.show(t('ct.hit', { sym: a.sym, dir: a.dir === 'above' ? '≥' : '≤', price: formatPrice(a.price), now: formatPrice(a.hitPrice ?? a.price) })));
    if (hit.length) window.dispatchEvent(new Event('zelos:alerts'));
  }, [q, toast]);
  return null;
}
