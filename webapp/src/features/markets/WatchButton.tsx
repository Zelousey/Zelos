/** ☆ Watch / ★ Watching on a stock page: adds it to or removes it from your watchlist. Signed-in only. */
import { useState } from 'react';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Button, useToast } from '../../ui';
import { unwatch, watch, WATCH_MAX } from './watchlist';

export function WatchButton({ sym }: { sym: string }) {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const me = useUserDoc(uid);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // a new player has no users doc yet: an empty watchlist
  if (!uid || (me.status !== 'ready' && me.status !== 'missing')) return null;
  const list = me.status === 'ready' ? me.data.watchlist : [];
  const on = list.includes(sym);
  async function flip() {
    setBusy(true);
    try {
      if (on) await unwatch(uid!, sym);
      else if (!(await watch(uid!, sym, list))) toast.show(t('wl.full', { n: WATCH_MAX }), 'error');
    } catch {
      toast.show(t('wl.failed'), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={on ? 'primary' : 'secondary'} size="sm" aria-pressed={on} disabled={busy} onClick={() => void flip()}>
      {on ? `★ ${t('wl.watching')}` : `☆ ${t('wl.watch')}`}
    </Button>
  );
}
