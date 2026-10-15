/**
 * Price alerts in the app shell. While the app is open: on every live quote update, alerts
 * whose price was crossed show a message once (the engine's store marks them triggered).
 * Signed in: the store is synced with your account (users/{uid}.twAlerts, shared with the
 * website), which is where the server checks them on every price update and notifies you
 * with the app closed (functions/price_alerts.py). It re-syncs when you come back to the
 * app, so alerts that fired meanwhile show as triggered.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { useQuotes } from '../../data/markets';
import { formatPrice } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useToast } from '../../ui';
import { engine, type CompatDb } from './engine';

/** The engine's store speaks the old Firestore API; this maps the two calls it makes. */
const compatDb: CompatDb = {
  collection: (name) => ({
    doc: (id) => {
      const ref = doc(db(), name, id);
      return {
        get: () => getDoc(ref).then((d) => ({ exists: d.exists(), data: () => d.data() })),
        set: (data, opts) => setDoc(ref, data, opts),
      };
    },
  }),
};

export function PriceAlertWatcher() {
  const q = useQuotes();
  const toast = useToast();
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  useEffect(() => {
    const store = engine().alerts;
    if (!uid) {
      store.attach(null, null);
      return;
    }
    const sync = () => store.attach(compatDb, uid, () => window.dispatchEvent(new Event('zelos:alerts')));
    const onShow = () => document.visibilityState === 'visible' && sync();
    sync();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [uid]);
  useEffect(() => {
    if (q.status !== 'ready') return;
    const prices = Object.fromEntries(Object.entries(q.data.quotes).map(([k, v]) => [k, v.c]));
    const hit = engine().alerts.check(prices);
    hit.forEach((a) => toast.show(t('ct.hit', { sym: a.sym, dir: a.dir === 'above' ? '≥' : '≤', price: formatPrice(a.price), now: formatPrice(a.hitPrice ?? a.price) })));
    if (hit.length) window.dispatchEvent(new Event('zelos:alerts'));
  }, [q, toast]);
  return null;
}
